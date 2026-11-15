"""Explainable private Projecte Viu guidance, never an automated project authority.

Only owner-scoped, persisted records feed deterministic recommendations.
No LLM, untrusted external retrieval, visibility changes or resource activation.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from campus_api.auth import DB, Actor, require_private_context
from campus_api.experiments import owned_draft
from campus_api.models import (
    ExperimentResult,
    ProjectDecision,
    ProjectExperiment,
    ProjectLifecycleEvent,
    ProjectResourceIntent,
    ProjectSuggestionFeedback,
    now,
)
from campus_api.schemas import Input, Output

router = APIRouter(
    prefix="/v1/idea-drafts/{draft_id}",
    tags=["inc ai project assistant"],
    dependencies=[Depends(require_private_context)],
)


class Suggestion(BaseModel):
    code: str
    title: str
    reason: str
    evidence_ids: list[str]
    action: Literal["review", "prepare_person", "prepare_resources", "prepare_funding"]
    optional: bool = True


class ProjectGuidance(BaseModel):
    lifecycle: Literal["undecided", "active", "paused", "closed"]
    latest_decision_id: str | None
    operational_effects: list[str]
    safeguards: list[str]
    suggestions: list[Suggestion]
    advisory_only: bool = True


@router.get("/assistant/guidance", response_model=ProjectGuidance)
def guidance(draft_id: UUID, db: DB, actor: Actor):
    draft = owned_draft(db, draft_id, actor)
    scope = str(draft_id)
    last_transition = db.scalar(
        select(ProjectLifecycleEvent)
        .where(
            ProjectLifecycleEvent.draft_id == scope,
            ProjectLifecycleEvent.owner_id == actor.id,
        )
        .order_by(ProjectLifecycleEvent.version.desc())
        .limit(1)
    )
    decisions = db.scalars(
        select(ProjectDecision)
        .where(ProjectDecision.draft_id == scope, ProjectDecision.owner_id == actor.id)
        .order_by(ProjectDecision.created_at.desc(), ProjectDecision.id.desc())
    ).all()
    experiments = db.scalars(
        select(ProjectExperiment)
        .where(ProjectExperiment.draft_id == scope, ProjectExperiment.owner_id == actor.id)
        .order_by(ProjectExperiment.created_at.desc(), ProjectExperiment.id.desc())
    ).all()
    intents = db.scalars(
        select(ProjectResourceIntent).where(
            ProjectResourceIntent.draft_id == scope, ProjectResourceIntent.owner_id == actor.id
        )
    ).all()
    latest = decisions[0] if decisions else None
    # Operational state is authoritative; decisions are historical, not actions.
    lifecycle = draft.lifecycle_state
    effects = [
        "L'estat operatiu es verifica al backend; les decisions històriques no l'alteren.",
        "Ni permisos, ni acords externs, ni obligacions es resolen automàticament.",
    ]
    if lifecycle != "active":
        effects.append(
            "Les noves execucions estan bloquejades; la consulta d'historial continua disponible."
        )
        effects.append(
            "La revisió de participants, acords i retenció és una declaració humana, "
            "no una cancel·lació externa verificada."
        )
    suggestions = []
    existing = {item.kind for item in intents}
    active = next((exp for exp in experiments if exp.status == "active"), None)
    if active:
        suggestions.append(
            Suggestion(
                code="review-active-experiment",
                title="Revisa la prova activa",
                reason=(
                    "Hi ha una prova activa sense resultat registrat; "
                    "defineix qui en fa el seguiment."
                ),
                evidence_ids=[active.id],
                action="review",
            )
        )
    last_result = None
    for exp in experiments:
        last_result = db.scalar(
            select(ExperimentResult)
            .where(
                ExperimentResult.experiment_id == exp.id,
                ExperimentResult.owner_id == actor.id,
            )
            .order_by(ExperimentResult.created_at.desc(), ExperimentResult.id.desc())
            .limit(1)
        )
        if last_result:
            break
    if last_result and last_result.outcome == "inconclusive":
        suggestions.append(
            Suggestion(
                code="reformulate-inconclusive",
                title="Considera una altra prova",
                reason="L'últim resultat consultat és inconcloent; pots reformular el mètode.",
                evidence_ids=[last_result.id],
                action="review",
            )
        )
    if latest and latest.choice == "request_help" and "person" not in existing:
        suggestions.append(
            Suggestion(
                code="person-after-help",
                title="Prepara una necessitat de col·laboració",
                reason=(
                    "La darrera decisió demana ajuda i encara no hi ha "
                    "una necessitat de persona registrada."
                ),
                evidence_ids=[latest.id],
                action="prepare_person",
            )
        )
    if active and "resources" not in existing:
        suggestions.append(
            Suggestion(
                code="resource-planning",
                title="Valora els recursos de la prova",
                reason="La prova està activa; pots descriure els recursos necessaris, si n'hi ha.",
                evidence_ids=[active.id],
                action="prepare_resources",
            )
        )
    if "resources" in existing and "funding" not in existing:
        related = next(item for item in intents if item.kind == "resources")
        suggestions.append(
            Suggestion(
                code="optional-funding",
                title="Valora si cal finançament",
                reason=(
                    "Has registrat una necessitat de recursos; el cost "
                    "i el finançament encara s'han de confirmar."
                ),
                evidence_ids=[related.id],
                action="prepare_funding",
            )
        )
    if lifecycle in ("paused", "closed"):
        suggestions = [
            Suggestion(
                code="review-lifecycle",
                title="Revisa els efectes de la decisió",
                reason=(
                    "El projecte està pausat o tancat operativament. "
                    "La situació dels compromisos requereix revisió humana."
                ),
                evidence_ids=[last_transition.id] if last_transition else [],
                action="review",
            )
        ]
    return ProjectGuidance(
        lifecycle=lifecycle,
        latest_decision_id=latest.id if latest else None,
        operational_effects=effects,
        safeguards=[
            "Les recomanacions són opcionals i basades només "
            "en registres del projecte autoritzats.",
            "No es canvien permisos, visibilitat, compromisos, pagaments ni estats de proves.",
            "No es revela ni es consulta informació d'altres usuaris o projectes.",
        ],
        suggestions=suggestions,
    )


ALLOWED_FEEDBACK = {
    "review-active-experiment",
    "reformulate-inconclusive",
    "person-after-help",
    "resource-planning",
    "optional-funding",
    "review-lifecycle",
}


class SuggestionFeedbackIn(Input):
    code: str
    choice: Literal["dismiss", "restore"]
    consent: bool


class SuggestionFeedbackOut(Output):
    id: str
    code: str
    choice: Literal["dismiss", "restore"]
    consent_at: datetime
    created_at: datetime


@router.get("/assistant/feedback", response_model=list[SuggestionFeedbackOut])
def list_suggestion_feedback(draft_id: UUID, db: DB, actor: Actor):
    owned_draft(db, draft_id, actor)
    records = db.scalars(
        select(ProjectSuggestionFeedback)
        .where(
            ProjectSuggestionFeedback.draft_id == str(draft_id),
            ProjectSuggestionFeedback.owner_id == actor.id,
        )
        .order_by(
            ProjectSuggestionFeedback.created_at.desc(),
            ProjectSuggestionFeedback.id.desc(),
        )
    ).all()
    latest = {}
    for record in records:
        if record.code not in latest:
            latest[record.code] = record
    return list(latest.values())


@router.post("/assistant/feedback", response_model=SuggestionFeedbackOut, status_code=201)
def save_suggestion_feedback(draft_id: UUID, payload: SuggestionFeedbackIn, db: DB, actor: Actor):
    owned_draft(db, draft_id, actor)
    if not payload.consent or payload.code not in ALLOWED_FEEDBACK:
        raise HTTPException(422, "Explicit consent and known suggestion code required")
    feedback = ProjectSuggestionFeedback(
        draft_id=str(draft_id),
        owner_id=actor.id,
        code=payload.code,
        choice=payload.choice,
        consent_at=now(),
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback
