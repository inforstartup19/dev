"""Private-by-default idea drafts. Ownership comes exclusively from verified OIDC."""

from datetime import datetime
from typing import Annotated
from uuid import NAMESPACE_URL, UUID, uuid5

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field, StringConstraints
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from campus_api.auth import DB, Actor, require_private_context
from campus_api.models import IdeaDraft, now
from campus_api.schemas import Input, Output

router = APIRouter(
    prefix="/v1/idea-drafts",
    tags=["private drafts"],
    dependencies=[Depends(require_private_context)],
)
Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class IdeaDraftIn(Input):
    question: Question
    intention: Annotated[str, Field(max_length=3000)] = ""
    next_test: Annotated[str, Field(max_length=3000)] = ""
    name: Annotated[str, Field(max_length=120)] = ""


class IdeaDraftOut(Output):
    id: str
    question: str
    intention: str
    next_test: str
    name: str
    visibility: str
    lifecycle_state: str
    lifecycle_version: int
    updated_at: datetime


def owned(db, draft_id, actor):
    item = db.scalar(
        select(IdeaDraft).where(IdeaDraft.id == str(draft_id), IdeaDraft.owner_id == actor.id)
    )
    if item is None:
        raise HTTPException(404, "Draft not found")
    return item


@router.get("", response_model=list[IdeaDraftOut])
def list_drafts(db: DB, actor: Actor, limit: Annotated[int, Query(ge=1, le=100)] = 50):
    query = (
        select(IdeaDraft)
        .where(IdeaDraft.owner_id == actor.id)
        .order_by(IdeaDraft.updated_at.desc(), IdeaDraft.id)
        .limit(limit)
    )
    return db.scalars(query).all()


@router.post("", response_model=IdeaDraftOut, status_code=201)
def create_draft(payload: IdeaDraftIn, db: DB, actor: Actor):
    item = IdeaDraft(owner_id=actor.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


class LocalDraftImportIn(IdeaDraftIn):
    source_id: Annotated[str, StringConstraints(min_length=1, max_length=100)]


@router.post("/local-import", response_model=IdeaDraftOut)
def import_local_draft(payload: LocalDraftImportIn, db: DB, actor: Actor):
    """Explicit copy of a short draft; retry-safe and owner scoped, never overwrite."""
    draft_id = str(
        uuid5(NAMESPACE_URL, f"incforstartup:local-short-v1:{actor.id}:{payload.source_id}")
    )
    fields = payload.model_dump(exclude={"source_id"})

    def existing():
        item = owned(db, draft_id, actor)
        if any(getattr(item, key) != value for key, value in fields.items()):
            raise HTTPException(409, "Local draft was already copied with different content")
        return item

    if db.scalar(
        select(IdeaDraft.id).where(IdeaDraft.id == draft_id, IdeaDraft.owner_id == actor.id)
    ):
        return existing()
    item = IdeaDraft(id=draft_id, owner_id=actor.id, **fields)
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # A concurrent retry may have inserted the same owner-scoped draft.
        from campus_api.db import bind_actor

        bind_actor(db, actor.id)
        return existing()
    db.refresh(item)
    return item


@router.get("/{draft_id}", response_model=IdeaDraftOut)
def get_draft(draft_id: UUID, db: DB, actor: Actor):
    return owned(db, draft_id, actor)


@router.post("/{draft_id}", response_model=IdeaDraftOut)
def update_draft(draft_id: UUID, payload: IdeaDraftIn, db: DB, actor: Actor):
    from campus_api.experiments import require_active

    item = require_active(db, draft_id, actor)
    for field, value in payload.model_dump().items():
        setattr(item, field, value)
    item.updated_at = now()
    db.commit()
    db.refresh(item)
    return item
