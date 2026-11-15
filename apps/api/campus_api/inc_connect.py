"""Inc Connect: short opt-in interest requests, no project or contact grants."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, StringConstraints
from sqlalchemy import func, select, update

from campus_api.auth import DB, Actor, require_private_context
from campus_api.models import ConnectEvent, ConnectRequest, ShareableNeed, now
from campus_api.schemas import Input, Output
from campus_api.shareable_needs import approved_viewer

router = APIRouter(
    prefix="/v1",
    tags=["consented connections"],
    dependencies=[Depends(require_private_context)],
)
Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
Decision = Literal["accepted", "declined", "withdrawn"]


class ConnectIn(Input):
    note: Note


class ConnectTransitionIn(Input):
    expected_version: int = Field(ge=0)
    decision: Decision
    confirm: Literal[True]


class ConnectOut(Output):
    id: str
    need_id: str
    role: Literal["owner", "requester"]
    note: str
    status: Literal["pending", "accepted", "declined", "withdrawn"]
    version: int
    created_at: datetime
    updated_at: datetime


class ConnectEventOut(Output):
    id: str
    action: Literal["requested", "accepted", "declined", "withdrawn"]
    version: int
    created_at: datetime


def view(item: ConnectRequest, actor: Actor):
    return {
        "id": item.id,
        "need_id": item.need_id,
        "role": "owner" if actor.id == item.owner_id else "requester",
        "note": item.note,
        "status": item.status,
        "version": item.version,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def owned_connection(db: DB, request_id: UUID, actor: Actor):
    item = db.scalar(
        select(ConnectRequest).where(
            ConnectRequest.id == str(request_id),
            (ConnectRequest.owner_id == actor.id) | (ConnectRequest.requester_id == actor.id),
        )
    )
    if item is None:
        raise HTTPException(404, "Connection not found")
    return item


@router.post("/shared-needs/{need_id}/connect-requests", response_model=ConnectOut, status_code=201)
def request_contact(need_id: UUID, payload: ConnectIn, db: DB, actor: Actor):
    need = db.scalar(
        select(ShareableNeed).where(
            ShareableNeed.id == str(need_id),
            approved_viewer(actor),
        )
    )
    if need is None or need.owner_id == actor.id:
        raise HTTPException(404, "Need not available for contact")
    # A narrow preflight reduces accidental/spam requests. A distributed
    # rate limiter and abuse-reporting system are required before public launch.
    pending = db.scalar(
        select(func.count(ConnectRequest.id)).where(
            ConnectRequest.requester_id == actor.id,
            ConnectRequest.status == "pending",
        )
    )
    if pending >= 5:
        raise HTTPException(429, "Too many pending contact requests")
    if db.scalar(
        select(ConnectRequest.id).where(
            ConnectRequest.need_id == need.id,
            ConnectRequest.requester_id == actor.id,
        )
    ):
        raise HTTPException(409, "A request already exists for this need")
    item = ConnectRequest(
        need_id=need.id,
        owner_id=need.owner_id,
        requester_id=actor.id,
        note=payload.note,
        status="pending",
        version=0,
    )
    db.add(item)
    db.flush()
    db.add(
        ConnectEvent(
            request_id=item.id,
            owner_id=item.owner_id,
            requester_id=item.requester_id,
            actor_id=actor.id,
            action="requested",
            version=0,
        )
    )
    db.commit()
    db.refresh(item)
    return view(item, actor)


@router.get("/connect-requests", response_model=list[ConnectOut])
def list_connections(db: DB, actor: Actor):
    items = db.scalars(
        select(ConnectRequest)
        .where((ConnectRequest.owner_id == actor.id) | (ConnectRequest.requester_id == actor.id))
        .order_by(ConnectRequest.created_at.desc(), ConnectRequest.id)
        .limit(100)
    ).all()
    return [view(item, actor) for item in items]


@router.get("/connect-requests/{request_id}", response_model=ConnectOut)
def get_connection(request_id: UUID, db: DB, actor: Actor):
    return view(owned_connection(db, request_id, actor), actor)


@router.post("/connect-requests/{request_id}/transitions", response_model=ConnectOut)
def decide_contact(request_id: UUID, payload: ConnectTransitionIn, db: DB, actor: Actor):
    item = owned_connection(db, request_id, actor)
    if item.status != "pending" or item.version != payload.expected_version:
        raise HTTPException(409, "Request already handled or stale version")
    if payload.decision == "withdrawn":
        if actor.id != item.requester_id:
            raise HTTPException(404, "Connection not found")
    elif actor.id != item.owner_id:
        raise HTTPException(404, "Connection not found")
    if payload.decision == "accepted":
        need = db.scalar(
            select(ShareableNeed).where(
                ShareableNeed.id == item.need_id,
                ShareableNeed.owner_id == item.owner_id,
                ShareableNeed.state == "published",
            )
        )
        if need is None:
            raise HTTPException(409, "The need is no longer available")
    changed = db.execute(
        update(ConnectRequest)
        .where(
            ConnectRequest.id == item.id,
            ConnectRequest.status == "pending",
            ConnectRequest.version == payload.expected_version,
        )
        .values(
            status=payload.decision,
            version=payload.expected_version + 1,
            updated_at=now(),
        )
        .execution_options(synchronize_session=False)
    )
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Concurrent request decision")
    db.add(
        ConnectEvent(
            request_id=item.id,
            owner_id=item.owner_id,
            requester_id=item.requester_id,
            actor_id=actor.id,
            action=payload.decision,
            version=payload.expected_version + 1,
        )
    )
    db.commit()
    db.refresh(item)
    return view(item, actor)


@router.get("/connect-requests/{request_id}/events", response_model=list[ConnectEventOut])
def contact_events(request_id: UUID, db: DB, actor: Actor):
    item = owned_connection(db, request_id, actor)
    return db.scalars(
        select(ConnectEvent)
        .where(
            ConnectEvent.request_id == item.id,
            (ConnectEvent.owner_id == actor.id) | (ConnectEvent.requester_id == actor.id),
        )
        .order_by(ConnectEvent.version)
    ).all()
