"""Owner-only operational lifecycle, separate from historical human decisions."""

import hashlib
import json
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, StringConstraints
from sqlalchemy import select, update

from campus_api.auth import DB, Actor, require_private_context
from campus_api.experiments import owned_draft
from campus_api.models import IdeaDraft, ProjectLifecycleEvent
from campus_api.schemas import Input, Output

router = APIRouter(
    prefix="/v1/idea-drafts/{draft_id}/lifecycle",
    tags=["projecte viu operational lifecycle"],
    dependencies=[Depends(require_private_context)],
)
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=3000)]
Review = Literal["experiments", "participants", "agreements", "retention"]
Action = Literal["pause", "close", "resume", "reopen"]
State = Literal["active", "paused", "closed"]
REQUIRED = {
    "pause": {"experiments", "participants", "agreements"},
    "close": {"experiments", "participants", "agreements", "retention"},
    "resume": {"experiments", "participants", "agreements"},
    "reopen": {"experiments", "participants", "agreements", "retention"},
}
TRANSITIONS = {
    "pause": {"active": "paused"},
    "close": {"active": "closed", "paused": "closed"},
    "resume": {"paused": "active"},
    "reopen": {"closed": "active"},
}


class LifecycleIn(Input):
    idempotency_key: UUID
    expected_version: int = Field(ge=0)
    action: Action
    reason: Text
    review_note: Text
    reviewed: list[Review] = Field(min_length=3, max_length=4)
    resume_conditions: Annotated[str, StringConstraints(strip_whitespace=True, max_length=3000)] = (
        ""
    )


class LifecycleEventOut(Output):
    id: str
    draft_id: str
    actor_id: str
    idempotency_key: str
    version: int
    action: Action
    previous_state: State
    next_state: State
    reason: str
    review_note: str
    reviewed: list[Review]
    resume_conditions: str
    created_at: datetime


class LifecycleOut(Output):
    state: State
    version: int
    permitted_actions: list[Action]
    blocked_operations: list[str]
    last_event: LifecycleEventOut | None


def permitted(state):
    return [action for action, paths in TRANSITIONS.items() if state in paths]


def lifecycle_guard(db, draft_id, actor):
    """Check ownership and state for a write; caller also locks parent during mutations."""
    draft = owned_draft(db, draft_id, actor)
    if draft.lifecycle_state != "active":
        raise HTTPException(409, "Project is paused or closed; resume/reopen explicitly")
    return draft


@router.get("", response_model=LifecycleOut)
def read_lifecycle(draft_id: UUID, db: DB, actor: Actor):
    draft = owned_draft(db, draft_id, actor)
    last = db.scalar(
        select(ProjectLifecycleEvent)
        .where(
            ProjectLifecycleEvent.draft_id == str(draft_id),
            ProjectLifecycleEvent.owner_id == actor.id,
        )
        .order_by(ProjectLifecycleEvent.version.desc())
        .limit(1)
    )
    return LifecycleOut(
        state=draft.lifecycle_state,
        version=draft.lifecycle_version,
        permitted_actions=permitted(draft.lifecycle_state),
        blocked_operations=(
            []
            if draft.lifecycle_state == "active"
            else [
                "edit_draft",
                "create_experiment",
                "edit_experiment",
                "activate_experiment",
                "record_result",
                "add_resource_intent",
            ]
        ),
        last_event=last,
    )


@router.get("/events", response_model=list[LifecycleEventOut])
def list_lifecycle(draft_id: UUID, db: DB, actor: Actor):
    owned_draft(db, draft_id, actor)
    return db.scalars(
        select(ProjectLifecycleEvent)
        .where(
            ProjectLifecycleEvent.draft_id == str(draft_id),
            ProjectLifecycleEvent.owner_id == actor.id,
        )
        .order_by(ProjectLifecycleEvent.version)
    ).all()


@router.post("/transitions", response_model=LifecycleEventOut, status_code=201)
def transition(draft_id: UUID, payload: LifecycleIn, db: DB, actor: Actor):
    draft = owned_draft(db, draft_id, actor)
    scope = str(draft_id)
    key = str(payload.idempotency_key)
    request_hash = hashlib.sha256(
        json.dumps(payload.model_dump(mode="json"), sort_keys=True).encode()
    ).hexdigest()
    previous = db.scalar(
        select(ProjectLifecycleEvent).where(
            ProjectLifecycleEvent.draft_id == scope,
            ProjectLifecycleEvent.owner_id == actor.id,
            ProjectLifecycleEvent.idempotency_key == key,
        )
    )
    if previous is not None:
        if previous.request_hash != request_hash:
            raise HTTPException(409, "Idempotency key already used with different request")
        return previous
    if set(payload.reviewed) != REQUIRED[payload.action] or len(payload.reviewed) != len(
        REQUIRED[payload.action]
    ):
        raise HTTPException(422, "Review each required impact category exactly once")
    if payload.action == "pause" and not payload.resume_conditions:
        raise HTTPException(422, "Pause requires documented resume conditions")
    if payload.action in ("resume", "reopen") and not payload.resume_conditions:
        raise HTTPException(422, "Resuming requires documented verification conditions")
    next_state = TRANSITIONS[payload.action].get(draft.lifecycle_state)
    if not next_state:
        raise HTTPException(409, "Invalid lifecycle transition")
    if draft.lifecycle_version != payload.expected_version:
        raise HTTPException(409, "Stale project version; refresh before retrying")
    # CAS provides a single winner under concurrent requests across API workers.
    changed = db.execute(
        update(IdeaDraft)
        .where(
            IdeaDraft.id == scope,
            IdeaDraft.owner_id == actor.id,
            IdeaDraft.lifecycle_state == draft.lifecycle_state,
            IdeaDraft.lifecycle_version == payload.expected_version,
        )
        .values(lifecycle_state=next_state, lifecycle_version=payload.expected_version + 1)
        .execution_options(synchronize_session=False)
    )
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Lifecycle changed concurrently; refresh")
    event = ProjectLifecycleEvent(
        draft_id=scope,
        owner_id=actor.id,
        actor_id=actor.id,
        idempotency_key=key,
        request_hash=request_hash,
        version=payload.expected_version + 1,
        action=payload.action,
        previous_state=draft.lifecycle_state,
        next_state=next_state,
        reason=payload.reason,
        review_note=payload.review_note,
        reviewed=payload.reviewed,
        resume_conditions=payload.resume_conditions,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
