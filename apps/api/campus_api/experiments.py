"""Private Projecte Viu experiments and declared evidence.

Every nested lookup scopes by the verified actor and parent resource.
Result records are append-only; they never confer third-party verification.
"""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, StringConstraints
from sqlalchemy import select

from campus_api.auth import DB, Actor, require_private_context
from campus_api.models import (
    ExperimentEvidence,
    ExperimentResult,
    IdeaDraft,
    ProjectExperiment,
)
from campus_api.schemas import Input, Output

router = APIRouter(
    prefix="/v1/idea-drafts/{draft_id}/experiments",
    tags=["projecte viu experiments"],
    dependencies=[Depends(require_private_context)],
)
Question = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=3000)]
Observation = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)
]
Outcome = Literal["supportive", "unsupported", "inconclusive"]


class ExperimentIn(Input):
    question: Question = ""
    method: LongText = ""
    success_criterion: LongText = ""
    reformulates_id: UUID | None = None


class ExperimentOut(Output):
    id: str
    draft_id: str
    reformulates_id: str | None
    question: str
    method: str
    success_criterion: str
    status: str
    created_at: datetime


class EvidenceIn(Input):
    reference: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)
    ]
    source_note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""


class ResultIn(Input):
    outcome: Outcome
    observations: Observation
    evidence: list[EvidenceIn] = Field(default_factory=list, max_length=10)


class EvidenceOut(Output):
    id: str
    result_id: str
    reference: str
    source_note: str
    review_status: str
    created_at: datetime


class ResultOut(Output):
    id: str
    experiment_id: str
    outcome: str
    observations: str
    created_at: datetime
    evidence: list[EvidenceOut]


def owned_draft(db, draft_id, actor):
    item = db.scalar(
        select(IdeaDraft).where(IdeaDraft.id == str(draft_id), IdeaDraft.owner_id == actor.id)
    )
    if item is None:
        raise HTTPException(404, "Draft not found")
    return item



def require_active(db, draft_id, actor):
    """Serialize project writes with operational transitions on PostgreSQL."""
    draft = db.scalar(
        select(IdeaDraft)
        .where(IdeaDraft.id == str(draft_id), IdeaDraft.owner_id == actor.id)
        .with_for_update()
    )
    if draft is None:
        raise HTTPException(404, "Draft not found")
    if draft.lifecycle_state != "active":
        raise HTTPException(409, "Project is paused or closed; resume/reopen explicitly")
    return draft

def owned_experiment(db, draft_id, experiment_id, actor):
    item = db.scalar(
        select(ProjectExperiment).where(
            ProjectExperiment.id == str(experiment_id),
            ProjectExperiment.draft_id == str(draft_id),
            ProjectExperiment.owner_id == actor.id,
        )
    )
    if item is None:
        raise HTTPException(404, "Experiment not found")
    return item


def owned_result(db, experiment_id, result_id, actor):
    item = db.scalar(
        select(ExperimentResult).where(
            ExperimentResult.id == str(result_id),
            ExperimentResult.experiment_id == str(experiment_id),
            ExperimentResult.owner_id == actor.id,
        )
    )
    if item is None:
        raise HTTPException(404, "Result not found")
    return item


def serialize_result(db, result, actor):
    evidence = db.scalars(
        select(ExperimentEvidence)
        .where(
            ExperimentEvidence.owner_id == actor.id,
            ExperimentEvidence.result_id == result.id,
        )
        .order_by(ExperimentEvidence.created_at, ExperimentEvidence.id)
    ).all()
    return ResultOut(
        id=result.id,
        experiment_id=result.experiment_id,
        outcome=result.outcome,
        observations=result.observations,
        created_at=result.created_at,
        evidence=[EvidenceOut.model_validate(item) for item in evidence],
    )


@router.get("", response_model=list[ExperimentOut])
def list_experiments(draft_id: UUID, db: DB, actor: Actor):
    owned_draft(db, draft_id, actor)
    return db.scalars(
        select(ProjectExperiment)
        .where(
            ProjectExperiment.draft_id == str(draft_id),
            ProjectExperiment.owner_id == actor.id,
        )
        .order_by(ProjectExperiment.created_at, ProjectExperiment.id)
    ).all()


@router.post("", response_model=ExperimentOut, status_code=201)
def create_experiment(draft_id: UUID, payload: ExperimentIn, db: DB, actor: Actor):
    require_active(db, draft_id, actor)
    parent_id = str(payload.reformulates_id) if payload.reformulates_id else None
    if parent_id:
        parent = owned_experiment(db, draft_id, payload.reformulates_id, actor)
        if parent.status != "completed":
            raise HTTPException(409, "Only completed experiments can be reformulated")
    fields = payload.model_dump(exclude={"reformulates_id"})
    ready = all((fields["question"], fields["method"], fields["success_criterion"]))
    experiment = ProjectExperiment(
        draft_id=str(draft_id),
        owner_id=actor.id,
        reformulates_id=parent_id,
        status="active" if ready else "draft",
        **fields,
    )
    db.add(experiment)
    db.commit()
    db.refresh(experiment)
    return experiment


@router.post("/{experiment_id}", response_model=ExperimentOut)
def edit_experiment(
    draft_id: UUID, experiment_id: UUID, payload: ExperimentIn, db: DB, actor: Actor
):
    require_active(db, draft_id, actor)
    experiment = owned_experiment(db, draft_id, experiment_id, actor)
    if experiment.status != "draft":
        raise HTTPException(409, "Executed experiment revisions are immutable")
    if (
        payload.reformulates_id is not None
        and str(payload.reformulates_id) != experiment.reformulates_id
    ):
        raise HTTPException(422, "Reformulation source cannot be changed")
    for field in ("question", "method", "success_criterion"):
        setattr(experiment, field, getattr(payload, field))
    db.commit()
    db.refresh(experiment)
    return experiment


@router.post("/{experiment_id}/activate", response_model=ExperimentOut)
def activate_experiment(draft_id: UUID, experiment_id: UUID, db: DB, actor: Actor):
    require_active(db, draft_id, actor)
    experiment = owned_experiment(db, draft_id, experiment_id, actor)
    if experiment.status != "draft":
        raise HTTPException(409, "Only draft experiments can be activated")
    if not all(
        (
            experiment.question.strip(),
            experiment.method.strip(),
            experiment.success_criterion.strip(),
        )
    ):
        raise HTTPException(422, "Question, method and success criterion are required to activate")
    experiment.status = "active"
    db.commit()
    db.refresh(experiment)
    return experiment


@router.get("/{experiment_id}/results", response_model=list[ResultOut])
def list_results(draft_id: UUID, experiment_id: UUID, db: DB, actor: Actor):
    owned_draft(db, draft_id, actor)
    owned_experiment(db, draft_id, experiment_id, actor)
    results = db.scalars(
        select(ExperimentResult)
        .where(
            ExperimentResult.experiment_id == str(experiment_id),
            ExperimentResult.owner_id == actor.id,
        )
        .order_by(ExperimentResult.created_at, ExperimentResult.id)
    ).all()
    return [serialize_result(db, result, actor) for result in results]


@router.post("/{experiment_id}/results", response_model=ResultOut, status_code=201)
def record_result(draft_id: UUID, experiment_id: UUID, payload: ResultIn, db: DB, actor: Actor):
    require_active(db, draft_id, actor)
    experiment = owned_experiment(db, draft_id, experiment_id, actor)
    if experiment.status == "draft":
        raise HTTPException(409, "Activate the experiment before recording a result")
    result = ExperimentResult(
        experiment_id=experiment.id,
        owner_id=actor.id,
        outcome=payload.outcome,
        observations=payload.observations,
    )
    db.add(result)
    db.flush()
    for evidence in payload.evidence:
        db.add(
            ExperimentEvidence(
                result_id=result.id,
                owner_id=actor.id,
                **evidence.model_dump(),
            )
        )
    experiment.status = "completed"
    db.commit()
    db.refresh(result)
    return serialize_result(db, result, actor)


@router.post(
    "/{experiment_id}/results/{result_id}/evidence",
    response_model=EvidenceOut,
    status_code=201,
)
def add_evidence(
    draft_id: UUID,
    experiment_id: UUID,
    result_id: UUID,
    payload: EvidenceIn,
    db: DB,
    actor: Actor,
):
    owned_draft(db, draft_id, actor)
    owned_experiment(db, draft_id, experiment_id, actor)
    result = owned_result(db, experiment_id, result_id, actor)
    item = ExperimentEvidence(result_id=result.id, owner_id=actor.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
