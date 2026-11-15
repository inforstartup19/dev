"""Private presentation facets; a facet never grants Campus or project access."""
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import StringConstraints
from sqlalchemy import select

from campus_api.auth import DB, Actor, require_private_context
from campus_api.models import IdentityFacet
from campus_api.schemas import Input, Output

router = APIRouter(
    prefix="/v1/me/facets", tags=["private identity facets"],
    dependencies=[Depends(require_private_context)],
)
Kind = Literal["creator", "student", "mentor", "professional"]
Summary = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]


class FacetIn(Input):
    kind: Kind
    summary: Summary = ""


class FacetOut(Output):
    id: str
    kind: Kind
    summary: str
    audience: Literal["private"]
    created_at: datetime


@router.get("", response_model=list[FacetOut])
def list_my_facets(db: DB, actor: Actor):
    return db.scalars(
        select(IdentityFacet)
        .where(IdentityFacet.user_id == actor.id)
        .order_by(IdentityFacet.kind)
    ).all()


@router.post("", response_model=FacetOut)
def save_my_facet(payload: FacetIn, db: DB, actor: Actor):
    facet = db.scalar(
        select(IdentityFacet).where(
            IdentityFacet.user_id == actor.id,
            IdentityFacet.kind == payload.kind,
        )
    )
    if facet is None:
        facet = IdentityFacet(
            user_id=actor.id, kind=payload.kind, summary=payload.summary,
            audience="private",
        )
        db.add(facet)
    else:
        facet.summary = payload.summary
    db.commit()
    db.refresh(facet)
    return facet
