"""Private Inc Proof claims: actor-scoped, versioned and never certified by AI."""

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
    ProofAttestation,
    ProofContribution,
    ProofEvidence,
)
from campus_api.schemas import Input, Output

router = APIRouter(
    prefix="/v1",
    tags=["Inc Proof"],
    dependencies=[Depends(require_private_context)],
)
Summary = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1200)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
Source = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
VersionLabel = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]
Provenance = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class ProofIn(Input):
    kind: Literal["work", "knowledge", "resource", "other"]
    summary: Summary


class EvidenceIn(Input):
    expected_version: int = Field(ge=1)
    origin: Literal["self", "experiment", "external"]
    source_reference: Source
    source_version: VersionLabel
    provenance: Provenance
    rights_note: Note


class AttestationIn(Input):
    expected_version: int = Field(ge=1)
    decision: Literal["confirm", "dispute"]
    note: Note
    confirm: Literal[True]


class WithdrawIn(Input):
    expected_version: int = Field(ge=1)
    reason: Note
    confirm: Literal[True]


class ProofOut(Output):
    id: str
    agreement_id: str
    kind: str
    summary: str
    version: int
    state: Literal["active", "withdrawn"]
    recognition: Literal[
        "declared", "participant_attested", "bilaterally_attested", "disputed", "withdrawn"
    ]
    confirmed_by_me: bool
    confirmed_by_counterpart: bool
    has_evidence: bool
    created_at: datetime


class EvidenceOut(Output):
    id: str
    proof_version: int
    origin: str
    source_reference: str
    source_version: str
    provenance: str
    rights_note: str
    review_state: Literal["declared"]
    audience: Literal["private"]
    created_at: datetime


class AttestationOut(Output):
    id: str
    proof_version: int
    decision: Literal["confirm", "dispute"]
    note: str
    created_at: datetime


def owned_proof(db: DB, proof_id: UUID, actor: Actor):
    proof = db.scalar(
        select(ProofContribution).where(
            ProofContribution.id == str(proof_id),
            (ProofContribution.owner_id == actor.id) | (ProofContribution.requester_id == actor.id),
        )
    )
    if proof is None:
        raise HTTPException(404, "Contribution not found")
    return proof


def proof_view(db: DB, proof: ProofContribution, actor: Actor):
    records = db.scalars(
        select(ProofAttestation).where(
            ProofAttestation.contribution_id == proof.id,
            ProofAttestation.proof_version == proof.version,
        )
    ).all()
    confirmations = {item.actor_id for item in records if item.decision == "confirm"}
    disputed = any(item.decision == "dispute" for item in records)
    if proof.state == "withdrawn":
        recognition = "withdrawn"
    elif disputed:
        recognition = "disputed"
    elif proof.owner_id in confirmations and proof.requester_id in confirmations:
        recognition = "bilaterally_attested"
    elif confirmations:
        recognition = "participant_attested"
    else:
        recognition = "declared"
    evidence = db.scalar(
        select(ProofEvidence.id).where(ProofEvidence.contribution_id == proof.id).limit(1)
    )
    other = proof.requester_id if actor.id == proof.owner_id else proof.owner_id
    return ProofOut(
        id=proof.id,
        agreement_id=proof.agreement_id,
        kind=proof.kind,
        summary=proof.summary,
        version=proof.version,
        state=proof.state,
        recognition=recognition,
        confirmed_by_me=actor.id in confirmations,
        confirmed_by_counterpart=other in confirmations,
        has_evidence=evidence is not None,
        created_at=proof.created_at,
    )


@router.post(
    "/agreements/{agreement_id}/proofs",
    response_model=ProofOut,
    status_code=201,
)
def declare_proof(agreement_id: UUID, payload: ProofIn, db: DB, actor: Actor):
    agreement = db.scalar(
        select(CollaborationAgreement).where(
            CollaborationAgreement.id == str(agreement_id),
            (CollaborationAgreement.owner_id == actor.id)
            | (CollaborationAgreement.requester_id == actor.id),
            CollaborationAgreement.status == "active",
        )
    )
    if agreement is None:
        raise HTTPException(404, "Active agreement not found")
    revision = db.scalar(
        select(AgreementRevision).where(
            AgreementRevision.agreement_id == agreement.id,
            AgreementRevision.version == agreement.current_version,
        )
    )
    if revision is None:
        raise HTTPException(409, "Current agreement revision unavailable")
    confirmers = set(
        db.scalars(
            select(AgreementConfirmation.actor_id).where(
                AgreementConfirmation.agreement_id == agreement.id,
                AgreementConfirmation.version == agreement.current_version,
                AgreementConfirmation.terms_sha256 == revision.terms_sha256,
            )
        ).all()
    )
    if not {agreement.owner_id, agreement.requester_id}.issubset(confirmers):
        raise HTTPException(409, "Both parties must confirm the agreement version")
    proof = ProofContribution(
        agreement_id=agreement.id,
        owner_id=agreement.owner_id,
        requester_id=agreement.requester_id,
        declared_by=actor.id,
        agreement_version=agreement.current_version,
        agreement_hash=revision.terms_sha256,
        kind=payload.kind,
        summary=payload.summary,
        version=1,
        state="active",
        withdrawal_reason="",
    )
    db.add(proof)
    db.commit()
    db.refresh(proof)
    return proof_view(db, proof, actor)


@router.get("/proofs", response_model=list[ProofOut])
def list_proofs(db: DB, actor: Actor):
    items = db.scalars(
        select(ProofContribution)
        .where(
            (ProofContribution.owner_id == actor.id) | (ProofContribution.requester_id == actor.id)
        )
        .order_by(ProofContribution.created_at.desc(), ProofContribution.id)
        .limit(100)
    ).all()
    return [proof_view(db, proof, actor) for proof in items]


@router.get("/proofs/{proof_id}", response_model=ProofOut)
def read_proof(proof_id: UUID, db: DB, actor: Actor):
    return proof_view(db, owned_proof(db, proof_id, actor), actor)


@router.get("/proofs/{proof_id}/evidence", response_model=list[EvidenceOut])
def list_evidence(proof_id: UUID, db: DB, actor: Actor):
    proof = owned_proof(db, proof_id, actor)
    return db.scalars(
        select(ProofEvidence)
        .where(ProofEvidence.contribution_id == proof.id)
        .order_by(ProofEvidence.proof_version)
    ).all()


@router.post("/proofs/{proof_id}/evidence", response_model=EvidenceOut, status_code=201)
def add_evidence(proof_id: UUID, payload: EvidenceIn, db: DB, actor: Actor):
    proof = owned_proof(db, proof_id, actor)
    if proof.state != "active" or proof.version != payload.expected_version:
        raise HTTPException(409, "Contribution withdrawn or stale version")
    if proof.declared_by != actor.id:
        raise HTTPException(403, "Only the declarant can add evidence to their claim")
    result = db.execute(
        update(ProofContribution)
        .where(
            ProofContribution.id == proof.id,
            ProofContribution.version == payload.expected_version,
            ProofContribution.state == "active",
        )
        .values(version=payload.expected_version + 1)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Concurrent proof revision")
    record = ProofEvidence(
        contribution_id=proof.id,
        owner_id=proof.owner_id,
        requester_id=proof.requester_id,
        declared_by=actor.id,
        proof_version=payload.expected_version + 1,
        origin=payload.origin,
        source_reference=payload.source_reference,
        source_version=payload.source_version,
        provenance=payload.provenance,
        rights_note=payload.rights_note,
        review_state="declared",
        audience="private",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/proofs/{proof_id}/attestations", response_model=list[AttestationOut])
def list_attestations(proof_id: UUID, db: DB, actor: Actor):
    proof = owned_proof(db, proof_id, actor)
    return db.scalars(
        select(ProofAttestation)
        .where(ProofAttestation.contribution_id == proof.id)
        .order_by(ProofAttestation.proof_version, ProofAttestation.created_at)
    ).all()


@router.post("/proofs/{proof_id}/attestations", response_model=ProofOut)
def attest_proof(proof_id: UUID, payload: AttestationIn, db: DB, actor: Actor):
    proof = owned_proof(db, proof_id, actor)
    if proof.state != "active" or proof.version != payload.expected_version:
        raise HTTPException(409, "Contribution withdrawn or stale version")
    previous = db.scalar(
        select(ProofAttestation).where(
            ProofAttestation.contribution_id == proof.id,
            ProofAttestation.proof_version == proof.version,
            ProofAttestation.actor_id == actor.id,
        )
    )
    if previous is not None:
        if previous.decision != payload.decision or previous.note != payload.note:
            raise HTTPException(409, "Attestation already recorded for this version")
        return proof_view(db, proof, actor)
    db.add(
        ProofAttestation(
            contribution_id=proof.id,
            owner_id=proof.owner_id,
            requester_id=proof.requester_id,
            actor_id=actor.id,
            proof_version=proof.version,
            decision=payload.decision,
            note=payload.note,
        )
    )
    db.commit()
    return proof_view(db, proof, actor)


@router.post("/proofs/{proof_id}/withdraw", response_model=ProofOut)
def withdraw_proof(proof_id: UUID, payload: WithdrawIn, db: DB, actor: Actor):
    proof = owned_proof(db, proof_id, actor)
    if proof.declared_by != actor.id:
        raise HTTPException(403, "Only the declarant can withdraw their claim")
    if proof.state != "active" or proof.version != payload.expected_version:
        raise HTTPException(409, "Contribution withdrawn or stale version")
    result = db.execute(
        update(ProofContribution)
        .where(
            ProofContribution.id == proof.id,
            ProofContribution.version == payload.expected_version,
            ProofContribution.state == "active",
        )
        .values(
            state="withdrawn",
            version=payload.expected_version + 1,
            withdrawn_by=actor.id,
            withdrawal_reason=payload.reason,
        )
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Concurrent withdrawal")
    db.commit()
    db.refresh(proof)
    return proof_view(db, proof, actor)
