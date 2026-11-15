"""Owner-created need projections; never expose the private parent to viewers."""
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field, StringConstraints
from sqlalchemy import and_, or_, select, update

from campus_api.auth import DB, Actor, require_private_context
from campus_api.idea_drafts import owned
from campus_api.models import IdeaDraft, NeedPublicationEvent, NeedViewerGrant, ShareableNeed, User
from campus_api.schemas import Input, Output

router = APIRouter(
    tags=["shareable needs"],
    dependencies=[Depends(require_private_context)],
)
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Description = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1200)
]
Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class NeedIn(Input):
    title: Title
    description: Description


class NeedOut(Output):
    # Intentionally exclude draft_id, owner_id, project name and private evidence.
    id: str
    title: str
    description: str
    state: Literal["draft", "published", "revoked"]
    audience: Literal["private", "authenticated", "selected"]
    version: int
    created_at: datetime


class TransitionIn(Input):
    expected_version: int = Field(ge=0)
    confirm: Literal[True]
    reason: Reason
    audience: Literal["authenticated", "selected"] | None = None



class ViewerGrantIn(Input):
    viewer_id: UUID
    confirm: Literal[True]


def approved_viewer(actor):
    """Enforce viewers in ORM too: SQLite has no PostgreSQL RLS."""
    viewer = select(NeedViewerGrant.id).where(
        NeedViewerGrant.need_id == ShareableNeed.id,
        NeedViewerGrant.viewer_id == actor.id,
    ).exists()
    return and_(
        ShareableNeed.state == "published",
        or_(
            ShareableNeed.audience == "authenticated",
            and_(ShareableNeed.audience == "selected", viewer),
        ),
    )


class NeedEventOut(Output):
    id: str
    need_id: str
    action: Literal["publish", "revoke"]
    version: int
    reason: str
    created_at: datetime


def owner_need(db, draft_id, need_id, actor):
    owned(db, draft_id, actor)
    item = db.scalar(
        select(ShareableNeed).where(
            ShareableNeed.id == str(need_id),
            ShareableNeed.draft_id == str(draft_id),
            ShareableNeed.owner_id == actor.id,
        )
    )
    if item is None:
        raise HTTPException(404, "Need not found")
    return item


@router.get("/v1/idea-drafts/{draft_id}/shared-needs", response_model=list[NeedOut])
def owned_needs(draft_id: UUID, db: DB, actor: Actor):
    owned(db, draft_id, actor)
    return db.scalars(
        select(ShareableNeed).where(
            ShareableNeed.draft_id == str(draft_id),
            ShareableNeed.owner_id == actor.id,
        ).order_by(ShareableNeed.created_at.desc())
    ).all()


@router.post("/v1/idea-drafts/{draft_id}/shared-needs", response_model=NeedOut, status_code=201)
def prepare_need(draft_id: UUID, payload: NeedIn, db: DB, actor: Actor):
    # A draft need remains private: it does NOT grant access to its parent project.
    from campus_api.experiments import require_active
    require_active(db, draft_id, actor)
    item = ShareableNeed(
        draft_id=str(draft_id), owner_id=actor.id,
        title=payload.title, description=payload.description,
        audience="private", state="draft", version=0,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item



@router.post("/v1/idea-drafts/{draft_id}/shared-needs/{need_id}/viewers", status_code=201)
def grant_viewer(draft_id: UUID, need_id: UUID, payload: ViewerGrantIn, db: DB, actor: Actor):
    item = owner_need(db, draft_id, need_id, actor)
    if item.state != "draft":
        raise HTTPException(409, "Configure recipients before publishing")
    if str(payload.viewer_id) == actor.id:
        raise HTTPException(422, "Owner already has access")
    viewer = db.scalar(select(User).where(User.id == str(payload.viewer_id)))
    if viewer is None:
        raise HTTPException(404, "Viewer account not found")
    if db.scalar(select(NeedViewerGrant).where(
        NeedViewerGrant.need_id == item.id,
        NeedViewerGrant.owner_id == actor.id,
        NeedViewerGrant.viewer_id == viewer.id,
    )) is not None:
        raise HTTPException(409, "Viewer already granted")
    grant = NeedViewerGrant(need_id=item.id, owner_id=actor.id, viewer_id=viewer.id)
    db.add(grant)
    db.commit()
    return {"id": grant.id, "viewer_id": viewer.id}


@router.get("/v1/idea-drafts/{draft_id}/shared-needs/{need_id}/viewers")
def list_viewers(draft_id: UUID, need_id: UUID, db: DB, actor: Actor):
    item = owner_need(db, draft_id, need_id, actor)
    return [{"viewer_id": grant.viewer_id} for grant in db.scalars(
        select(NeedViewerGrant).where(
            NeedViewerGrant.need_id == item.id,
            NeedViewerGrant.owner_id == actor.id,
        )
    ).all()]


@router.get("/v1/shared-needs", response_model=list[NeedOut])
def discover_needs(db: DB, actor: Actor, limit: Annotated[int, Query(ge=1, le=100)] = 50):
    # Explicit projection; RLS independently protects this query.
    return db.scalars(
        select(ShareableNeed).where(
            approved_viewer(actor),
        ).order_by(ShareableNeed.created_at.desc(), ShareableNeed.id).limit(limit)
    ).all()


@router.get("/v1/shared-needs/{need_id}", response_model=NeedOut)
def public_need(need_id: UUID, db: DB, actor: Actor):
    item = db.scalar(
        select(ShareableNeed).where(
            ShareableNeed.id == str(need_id),
            approved_viewer(actor),
        )
    )
    if item is None:
        raise HTTPException(404, "Need not available")
    return item


@router.post(
    "/v1/idea-drafts/{draft_id}/shared-needs/{need_id}/publish",
    response_model=NeedOut,
)
def publish_need(draft_id: UUID, need_id: UUID, payload: TransitionIn, db: DB, actor: Actor):
    # Project lifecycle and publication are serialized by locking the parent.
    parent = db.scalar(
        select(IdeaDraft).where(
            IdeaDraft.id == str(draft_id), IdeaDraft.owner_id == actor.id
        ).with_for_update()
    )
    if parent is None:
        raise HTTPException(404, "Draft not found")
    if parent.lifecycle_state != "active":
        raise HTTPException(409, "Project is not active")
    item = owner_need(db, draft_id, need_id, actor)
    if item.state != "draft" or item.version != payload.expected_version:
        raise HTTPException(409, "Stale or invalid publication")
    if payload.audience is None:
        raise HTTPException(422, "Explicit audience required")
    if payload.audience == "selected" and not db.scalar(
        select(NeedViewerGrant.id).where(NeedViewerGrant.need_id == item.id)
    ):
        raise HTTPException(422, "Select at least one recipient before publishing")
    changed = db.execute(
        update(ShareableNeed).where(
            ShareableNeed.id == item.id, ShareableNeed.owner_id == actor.id,
            ShareableNeed.state == "draft",
            ShareableNeed.version == payload.expected_version,
        ).values(
            state="published", audience=payload.audience,
            version=payload.expected_version + 1,
        ).execution_options(synchronize_session=False)
    )
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Concurrent publication")
    db.add(NeedPublicationEvent(
        need_id=item.id, owner_id=actor.id, actor_id=actor.id,
        action="publish", version=payload.expected_version + 1,
        reason=payload.reason,
    ))
    db.commit()
    db.refresh(item)
    return item


@router.post(
    "/v1/idea-drafts/{draft_id}/shared-needs/{need_id}/revoke",
    response_model=NeedOut,
)
def revoke_need(draft_id: UUID, need_id: UUID, payload: TransitionIn, db: DB, actor: Actor):
    item = owner_need(db, draft_id, need_id, actor)
    if item.state != "published" or item.version != payload.expected_version:
        raise HTTPException(409, "Stale or invalid revocation")
    changed = db.execute(
        update(ShareableNeed).where(
            ShareableNeed.id == item.id, ShareableNeed.owner_id == actor.id,
            ShareableNeed.state == "published",
            ShareableNeed.version == payload.expected_version,
        ).values(
            state="revoked", audience="private", version=payload.expected_version + 1,
        ).execution_options(synchronize_session=False)
    )
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Concurrent revocation")
    db.add(NeedPublicationEvent(
        need_id=item.id, owner_id=actor.id, actor_id=actor.id,
        action="revoke", version=payload.expected_version + 1,
        reason=payload.reason,
    ))
    db.commit()
    db.refresh(item)
    return item


@router.get(
    "/v1/idea-drafts/{draft_id}/shared-needs/{need_id}/events",
    response_model=list[NeedEventOut],
)
def publication_history(draft_id: UUID, need_id: UUID, db: DB, actor: Actor):
    item = owner_need(db, draft_id, need_id, actor)
    return db.scalars(
        select(NeedPublicationEvent).where(
            NeedPublicationEvent.need_id == item.id,
            NeedPublicationEvent.owner_id == actor.id,
        ).order_by(NeedPublicationEvent.version)
    ).all()
