"""Versioned bilateral proposals with human confirmations; not legal signatures."""

import hashlib
import json
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, StringConstraints
from sqlalchemy import select, update

from campus_api.auth import DB, Actor, require_private_context
from campus_api.models import (
    AgreementConfirmation,
    AgreementRevision,
    CollaborationAgreement,
    ConnectRequest,
    ShareableNeed,
    now,
)
from campus_api.schemas import Input, Output

router = APIRouter(
    prefix="/v1/agreements",
    tags=["bilateral agreements"],
    dependencies=[Depends(require_private_context)],
)
Short = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
Long = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1200)]


class Terms(Input):
    goal: Long
    contribution: Long
    commitment: Short
    deliverable: Long
    conditions: Long
    access_scope: Short


class AgreementIn(Input):
    request_id: UUID
    terms: Terms


class RevisionIn(Input):
    expected_version: int = Field(ge=1)
    terms: Terms


class ConfirmationIn(Input):
    expected_version: int = Field(ge=1)
    expected_hash: Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$")]
    confirm: Literal[True]


class CancelIn(Input):
    expected_version: int = Field(ge=1)
    reason: Short
    confirm: Literal[True]


class AgreementOut(Output):
    id: str
    request_id: str
    status: Literal["active", "cancelled"]
    version: int
    terms: dict
    terms_sha256: str
    owner_confirmed: bool
    requester_confirmed: bool
    fully_confirmed: bool
    cancelled_reason: str
    created_at: datetime


class RevisionOut(Output):
    version: int
    terms: dict
    terms_sha256: str
    created_at: datetime


def hash_terms(value):
    return hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def participant_agreement(db: DB, id: UUID, actor: Actor):
    item = db.scalar(
        select(CollaborationAgreement).where(
            CollaborationAgreement.id == str(id),
            (CollaborationAgreement.owner_id == actor.id)
            | (CollaborationAgreement.requester_id == actor.id),
        )
    )
    if item is None:
        raise HTTPException(404, "Agreement not found")
    return item


def snapshot(db: DB, item: CollaborationAgreement):
    revision = db.scalar(
        select(AgreementRevision).where(
            AgreementRevision.agreement_id == item.id,
            AgreementRevision.version == item.current_version,
        )
    )
    if revision is None:
        raise HTTPException(409, "Agreement revision is missing")
    authors = set(
        db.scalars(
            select(AgreementConfirmation.actor_id).where(
                AgreementConfirmation.agreement_id == item.id,
                AgreementConfirmation.version == item.current_version,
                AgreementConfirmation.terms_sha256 == revision.terms_sha256,
            )
        ).all()
    )
    owner_confirmed = item.owner_id in authors
    requester_confirmed = item.requester_id in authors
    return AgreementOut(
        id=item.id,
        request_id=item.request_id,
        status=item.status,
        version=item.current_version,
        terms=revision.terms,
        terms_sha256=revision.terms_sha256,
        owner_confirmed=owner_confirmed,
        requester_confirmed=requester_confirmed,
        fully_confirmed=item.status == "active" and owner_confirmed and requester_confirmed,
        cancelled_reason=item.cancelled_reason,
        created_at=item.created_at,
    )


@router.post("", response_model=AgreementOut, status_code=201)
def create_agreement(payload: AgreementIn, db: DB, actor: Actor):
    request = db.scalar(
        select(ConnectRequest).where(
            ConnectRequest.id == str(payload.request_id),
            (ConnectRequest.owner_id == actor.id) | (ConnectRequest.requester_id == actor.id),
            ConnectRequest.status == "accepted",
        )
    )
    if request is None:
        raise HTTPException(404, "Accepted contact not found")
    need = db.scalar(
        select(ShareableNeed).where(
            ShareableNeed.id == request.need_id,
            ShareableNeed.owner_id == request.owner_id,
            ShareableNeed.state == "published",
        )
    )
    if need is None:
        raise HTTPException(409, "The need is no longer published")
    if db.scalar(
        select(CollaborationAgreement.id).where(CollaborationAgreement.request_id == request.id)
    ):
        raise HTTPException(409, "An agreement already exists for this request")
    agreement = CollaborationAgreement(
        request_id=request.id,
        owner_id=request.owner_id,
        requester_id=request.requester_id,
        current_version=1,
        status="active",
        cancelled_reason="",
    )
    db.add(agreement)
    db.flush()
    terms = payload.terms.model_dump()
    db.add(
        AgreementRevision(
            agreement_id=agreement.id,
            owner_id=agreement.owner_id,
            requester_id=agreement.requester_id,
            actor_id=actor.id,
            version=1,
            terms=terms,
            terms_sha256=hash_terms(terms),
        )
    )
    db.commit()
    return snapshot(db, agreement)


@router.get("", response_model=list[AgreementOut])
def list_agreements(db: DB, actor: Actor):
    items = db.scalars(
        select(CollaborationAgreement)
        .where(
            (CollaborationAgreement.owner_id == actor.id)
            | (CollaborationAgreement.requester_id == actor.id)
        )
        .order_by(CollaborationAgreement.created_at.desc())
        .limit(100)
    ).all()
    return [snapshot(db, item) for item in items]


@router.get("/{agreement_id}", response_model=AgreementOut)
def read_agreement(agreement_id: UUID, db: DB, actor: Actor):
    return snapshot(db, participant_agreement(db, agreement_id, actor))


@router.get("/{agreement_id}/revisions", response_model=list[RevisionOut])
def list_revisions(agreement_id: UUID, db: DB, actor: Actor):
    agreement = participant_agreement(db, agreement_id, actor)
    return db.scalars(
        select(AgreementRevision)
        .where(AgreementRevision.agreement_id == agreement.id)
        .order_by(AgreementRevision.version)
    ).all()


@router.post("/{agreement_id}/revisions", response_model=AgreementOut)
def revise_agreement(agreement_id: UUID, payload: RevisionIn, db: DB, actor: Actor):
    item = participant_agreement(db, agreement_id, actor)
    if item.status != "active" or item.current_version != payload.expected_version:
        raise HTTPException(409, "Cancelled or outdated agreement")
    changed = db.execute(
        update(CollaborationAgreement)
        .where(
            CollaborationAgreement.id == item.id,
            CollaborationAgreement.current_version == payload.expected_version,
            CollaborationAgreement.status == "active",
        )
        .values(current_version=payload.expected_version + 1, updated_at=now())
        .execution_options(synchronize_session=False)
    )
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Concurrent agreement revision")
    terms = payload.terms.model_dump()
    db.add(
        AgreementRevision(
            agreement_id=item.id,
            owner_id=item.owner_id,
            requester_id=item.requester_id,
            actor_id=actor.id,
            version=payload.expected_version + 1,
            terms=terms,
            terms_sha256=hash_terms(terms),
        )
    )
    db.commit()
    db.refresh(item)
    return snapshot(db, item)


@router.post("/{agreement_id}/confirmations", response_model=AgreementOut)
def confirm_agreement(agreement_id: UUID, payload: ConfirmationIn, db: DB, actor: Actor):
    item = participant_agreement(db, agreement_id, actor)
    if item.status != "active" or item.current_version != payload.expected_version:
        raise HTTPException(409, "Cancelled or outdated agreement")
    revision = db.scalar(
        select(AgreementRevision).where(
            AgreementRevision.agreement_id == item.id,
            AgreementRevision.version == payload.expected_version,
        )
    )
    if revision is None or payload.expected_hash != revision.terms_sha256:
        raise HTTPException(409, "Agreement hash changed; review latest terms")
    recorded = db.scalar(
        select(AgreementConfirmation.id).where(
            AgreementConfirmation.agreement_id == item.id,
            AgreementConfirmation.version == payload.expected_version,
            AgreementConfirmation.actor_id == actor.id,
        )
    )
    if recorded is None:
        db.add(
            AgreementConfirmation(
                agreement_id=item.id,
                owner_id=item.owner_id,
                requester_id=item.requester_id,
                actor_id=actor.id,
                version=payload.expected_version,
                terms_sha256=revision.terms_sha256,
            )
        )
        db.commit()
    return snapshot(db, item)


@router.post("/{agreement_id}/cancel", response_model=AgreementOut)
def cancel_agreement(agreement_id: UUID, payload: CancelIn, db: DB, actor: Actor):
    item = participant_agreement(db, agreement_id, actor)
    if item.current_version != payload.expected_version or item.status != "active":
        raise HTTPException(409, "Cancelled or outdated agreement")
    changed = db.execute(
        update(CollaborationAgreement)
        .where(
            CollaborationAgreement.id == item.id,
            CollaborationAgreement.current_version == payload.expected_version,
            CollaborationAgreement.status == "active",
        )
        .values(
            status="cancelled",
            cancelled_by=actor.id,
            cancelled_reason=payload.reason,
            updated_at=now(),
        )
        .execution_options(synchronize_session=False)
    )
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Concurrent agreement cancellation")
    db.commit()
    db.refresh(item)
    return snapshot(db, item)
