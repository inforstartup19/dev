"""Explainable private Projecte Viu guidance, never an automated project authority.

Only owner-scoped, persisted records feed deterministic recommendations.
No LLM, untrusted external retrieval, visibility changes or resource activation.
"""
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select

from campus_api.auth import DB, Actor, require_private_context
from campus_api.experiments import owned_draft
from campus_api.models import (
    ExperimentResult, ProjectDecision, ProjectExperiment, ProjectResourceIntent,
)

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
    owned_draft(db, draft_id, actor)
    scope = str(draft_id)
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
        select(ProjectResourceIntent)
        .where(ProjectResourceIntent.draft_id == scope, ProjectResourceIntent.owner_id == actor.id)
    ).all()
    latest = decisions[0] if decisions else None
    lifecycle = (
        "paused" if latest and latest.choice == "pause"
        else "closed" if latest and latest.choice == "close"
        else "active" if latest else "undecided"
    )
    effects = []
    if lifecycle in ("paused", "closed"):
        effects = [
            "La decisió consta a l'historial; no bloqueja tècnicament noves proves.",
            "Revisa proves actives, participants i compromisos abans de comunicar cap suspensió o tancament.",
            "Les evidències i decisions romanen consultables amb els permisos existents.",
            "No s'han cancel·lat acords, invitacions, pagaments ni accessos automàticament.",
        ]
        if lifecycle == "paused":
            effects.append("Documenta condicions de represa i responsables abans de tornar a executar.")
        else:
            effects.append("Revisa retenció, obligacions i eventual reobertura de forma separada.")
    else:
        effects = ["Cap restricció operativa automàtica derivada de les decisions."]
    suggestions = []
    existing = {item.kind for item in intents}
    active = next((exp for exp in experiments if exp.status == "active"), None)
    if active:
        suggestions.append(Suggestion(
            code="review-active-experiment", title="Revisa la prova activa",
            reason="Hi ha una prova activa sense resultat registrat; defineix qui en fa el seguiment.",
            evidence_ids=[active.id], action="review",
        ))
    last_result = None
    for exp in experiments:
        last_result = db.scalar(
            select(ExperimentResult).where(
                ExperimentResult.experiment_id == exp.id,
                ExperimentResult.owner_id == actor.id,
            ).order_by(ExperimentResult.created_at.desc(), ExperimentResult.id.desc()).limit(1)
        )
        if last_result:
            break
    if last_result and last_result.outcome == "inconclusive":
        suggestions.append(Suggestion(
            code="reformulate-inconclusive", title="Considera una altra prova",
            reason="L'últim resultat consultat és inconcloent; pots reformular el mètode.",
            evidence_ids=[last_result.id], action="review",
        ))
    if latest and latest.choice == "request_help" and "person" not in existing:
        suggestions.append(Suggestion(
            code="person-after-help", title="Prepara una necessitat de col·laboració",
            reason="La darrera decisió demana ajuda i encara no hi ha una necessitat de persona registrada.",
            evidence_ids=[latest.id], action="prepare_person",
        ))
    if active and "resources" not in existing:
        suggestions.append(Suggestion(
            code="resource-planning", title="Valora els recursos de la prova",
            reason="La prova està activa; pots descriure els recursos necessaris, si n'hi ha.",
            evidence_ids=[active.id], action="prepare_resources",
        ))
    if "resources" in existing and "funding" not in existing:
        related = next(item for item in intents if item.kind == "resources")
        suggestions.append(Suggestion(
            code="optional-funding", title="Valora si cal finançament",
            reason="Has registrat una necessitat de recursos; el cost i el finançament encara s'han de confirmar.",
            evidence_ids=[related.id], action="prepare_funding",
        ))
    if lifecycle in ("paused", "closed"):
        suggestions = [Suggestion(
            code="review-lifecycle", title="Revisa els efectes de la decisió",
            reason="La darrera decisió és pausar o tancar. La situació dels compromisos requereix revisió humana.",
            evidence_ids=[latest.id], action="review",
        )]
    return ProjectGuidance(
        lifecycle=lifecycle,
        latest_decision_id=latest.id if latest else None,
        operational_effects=effects,
        safeguards=[
            "Les recomanacions són opcionals i basades només en registres del projecte autoritzats.",
            "No es canvien permisos, visibilitat, compromisos, pagaments ni estats de proves.",
            "No es revela ni es consulta informació d'altres usuaris o projectes.",
        ],
        suggestions=suggestions,
    )
