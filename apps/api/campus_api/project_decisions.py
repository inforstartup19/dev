"""Append-only human choices and private optional project resource intents."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import StringConstraints
from sqlalchemy import select

from campus_api.auth import DB, Actor, require_private_context
from campus_api.experiments import owned_draft, owned_experiment
from campus_api.models import ProjectDecision, ProjectResourceIntent
from campus_api.schemas import Input, Output

router = APIRouter(
    prefix="/v1/idea-drafts/{draft_id}",
    tags=["projecte viu decisions"],
    dependencies=[Depends(require_private_context)],
)

Description = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=3000)
]
Choice = Literal["continue", "reformulate", "request_help", "pause", "close"]
Kind = Literal["person", "resources", "funding"]


class DecisionIn(Input):
    experiment_id: UUID | None = None
    choice: Choice
    rationale: Description


class DecisionOut(Output):
    id: str
    draft_id: str
    experiment_id: str | None
    choice: Choice
    rationale: str
    created_at: datetime


class ResourceIntentIn(Input):
    kind: Kind
    description: Description


class ResourceIntentOut(Output):
    id: str
    draft_id: str
    kind: Kind
    description: str
    created_at: datetime


@router.get("/decisions", response_model=list[DecisionOut])
def list_decisions(draft_id: UUID, db: DB, actor: Actor):
    owned_draft(db, draft_id, actor)
    return db.scalars(
        select(ProjectDecision)
        .where(
            ProjectDecision.draft_id == str(draft_id),
            ProjectDecision.owner_id == actor.id,
        )
        .order_by(ProjectDecision.created_at, ProjectDecision.id)
    ).all()


@router.post("/decisions", response_model=DecisionOut, status_code=201)
def record_decision(draft_id: UUID, payload: DecisionIn, db: DB, actor: Actor):
    owned_draft(db, draft_id, actor)
    experiment_id = None
    if payload.experiment_id:
        experiment = owned_experiment(db, draft_id, payload.experiment_id, actor)
        experiment_id = experiment.id
        if experiment.status == "draft":
            raise HTTPException(409, "Cannot decide about an unexecuted draft experiment")
    decision = ProjectDecision(
        draft_id=str(draft_id),
        experiment_id=experiment_id,
        owner_id=actor.id,
        choice=payload.choice,
        rationale=payload.rationale,
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)
    # A choice is a historical record, not an automatic status/visibility change.
    return decision


@router.get("/resource-intents", response_model=list[ResourceIntentOut])
def list_resource_intents(draft_id: UUID, db: DB, actor: Actor):
    owned_draft(db, draft_id, actor)
    return db.scalars(
        select(ProjectResourceIntent)
        .where(
            ProjectResourceIntent.draft_id == str(draft_id),
            ProjectResourceIntent.owner_id == actor.id,
        )
        .order_by(ProjectResourceIntent.created_at, ProjectResourceIntent.id)
    ).all()


@router.post("/resource-intents", response_model=ResourceIntentOut, status_code=201)
def add_resource_intent(draft_id: UUID, payload: ResourceIntentIn, db: DB, actor: Actor):
    owned_draft(db, draft_id, actor)
    item = ProjectResourceIntent(draft_id=str(draft_id), owner_id=actor.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    # No public sharing, contacts, invitations or financial transfers.
    return item
