from datetime import UTC, date, datetime
from uuid import uuid4

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from campus_api.db import Base


def now():
    return datetime.now(UTC)


def identifier():
    return str(uuid4())


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    auth_subject: Mapped[str] = mapped_column(String(1024), unique=True)
    display_name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Space(Base):
    __tablename__ = "spaces"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    title: Mapped[str] = mapped_column(String(100))
    subject: Mapped[str] = mapped_column(String(150))
    due_at: Mapped[date | None] = mapped_column(Date)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SpaceMembership(Base):
    __tablename__ = "space_memberships"
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    role: Mapped[str] = mapped_column(String(10))
    __table_args__ = (
        CheckConstraint("role IN ('teacher', 'student')", name="ck_space_role"),
        Index("ix_space_membership_user", "user_id", "space_id"),
    )


class Team(Base):
    __tablename__ = "teams"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class TeamMembership(Base):
    __tablename__ = "team_memberships"
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    __table_args__ = (Index("ix_team_membership_user", "user_id", "team_id"),)


class Invitation(Base):
    __tablename__ = "invitations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id"), index=True)
    team_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), index=True)
    title: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(5000))
    category: Mapped[str] = mapped_column(String(100))
    next_version: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (CheckConstraint("next_version > 0", name="ck_project_version"),)


class Submission(Base):
    __tablename__ = "submissions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    version_number: Mapped[int]
    note: Mapped[str] = mapped_column(String(10000))
    submitted_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        UniqueConstraint("project_id", "version_number", name="uq_submission_version"),
        CheckConstraint("version_number > 0", name="ck_submission_version"),
    )


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    submission_id: Mapped[str] = mapped_column(ForeignKey("submissions.id"), unique=True)
    reviewer_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    scores: Mapped[list[float]] = mapped_column(JSON)
    rubric_snapshot: Mapped[list[dict]] = mapped_column(JSON)
    feedback: Mapped[str] = mapped_column(String(5000))
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str] = mapped_column(String(36))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ProjectVault(Base):
    """One private project boundary; unrelated to Campus teacher/team permissions."""

    __tablename__ = "project_vaults"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    name: Mapped[str] = mapped_column(String(100))
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (Index("uq_vault_owner", "id", "created_by", unique=True),)


class VaultMembership(Base):
    __tablename__ = "vault_memberships"
    vault_id: Mapped[str] = mapped_column(ForeignKey("project_vaults.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    role: Mapped[str] = mapped_column(String(12))
    owner_id: Mapped[str] = mapped_column(String(36))
    __table_args__ = (
        CheckConstraint("role IN ('owner', 'contributor', 'reader')", name="ck_vault_role"),
        Index("ix_vault_membership_user", "user_id", "vault_id"),
        ForeignKeyConstraint(
            ["vault_id", "owner_id"],
            ["project_vaults.id", "project_vaults.created_by"],
            name="fk_membership_vault_owner",
        ),
        CheckConstraint(
            "role <> 'owner' OR user_id = owner_id", name="ck_membership_owner_identity"
        ),
    )


class VaultEvent(Base):
    __tablename__ = "vault_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    vault_id: Mapped[str] = mapped_column(ForeignKey("project_vaults.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(40))
    target_id: Mapped[str] = mapped_column(String(36))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    owner_id: Mapped[str] = mapped_column(String(36))
    __table_args__ = (
        ForeignKeyConstraint(
            ["vault_id", "owner_id"],
            ["project_vaults.id", "project_vaults.created_by"],
            name="fk_event_vault_owner",
        ),
    )


class VaultDocument(Base):
    __tablename__ = "vault_documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    vault_id: Mapped[str] = mapped_column(ForeignKey("project_vaults.id"), index=True)
    owner_id: Mapped[str] = mapped_column(String(36))
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    filename: Mapped[str] = mapped_column(String(180))
    media_type: Mapped[str] = mapped_column(String(40))
    size: Mapped[int]
    sha256: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16), default="uploading")
    source_etag: Mapped[str | None] = mapped_column(String(100))
    source_version: Mapped[str | None] = mapped_column(String(100))
    released_etag: Mapped[str | None] = mapped_column(String(100))
    released_version: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(
            ["vault_id", "owner_id"],
            ["project_vaults.id", "project_vaults.created_by"],
            name="fk_document_vault_owner",
        ),
        CheckConstraint(
            "status IN ('uploading', 'quarantined', 'released', 'blocked', 'failed')",
            name="ck_document_status",
        ),
        CheckConstraint("size > 0 AND size <= 10485760", name="ck_document_size"),
        CheckConstraint(
            "status NOT IN ('quarantined','released') OR "
            "(source_etag IS NOT NULL AND source_version IS NOT NULL "
            "AND source_etag <> '' AND source_version <> '')",
            name="ck_document_source_version",
        ),
        CheckConstraint(
            "status <> 'released' OR (released_etag IS NOT NULL AND released_version IS NOT NULL)",
            name="ck_document_released_version",
        ),
        Index("uq_document_vault", "id", "vault_id", unique=True),
    )


class ScanReceipt(Base):
    __tablename__ = "document_scan_receipts"
    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    document_id: Mapped[str] = mapped_column(String(36))
    vault_id: Mapped[str] = mapped_column(String(36), index=True)
    event_sha256: Mapped[str] = mapped_column(String(64))
    outcome: Mapped[str] = mapped_column(String(16))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(
            ["document_id", "vault_id"],
            ["vault_documents.id", "vault_documents.vault_id"],
            name="fk_receipt_document_vault",
        ),
    )


class IdeaDraft(Base):
    __tablename__ = "idea_drafts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    question: Mapped[str] = mapped_column(String(2000))
    intention: Mapped[str] = mapped_column(String(3000), default="")
    next_test: Mapped[str] = mapped_column(String(3000), default="")
    name: Mapped[str] = mapped_column(String(120), default="")
    visibility: Mapped[str] = mapped_column(String(12), default="private")
    lifecycle_state: Mapped[str] = mapped_column(String(12), default="active")
    lifecycle_version: Mapped[int] = mapped_column(default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        CheckConstraint("visibility = 'private'", name="ck_idea_drafts_private"),
        CheckConstraint(
            "lifecycle_state IN ('active', 'paused', 'closed')",
            name="ck_idea_drafts_lifecycle",
        ),
        CheckConstraint("lifecycle_version >= 0", name="ck_idea_drafts_lifecycle_version"),
        CheckConstraint("length(trim(question)) > 0", name="ck_idea_drafts_question"),
        Index("ix_idea_drafts_owner_updated", "owner_id", "updated_at"),
        UniqueConstraint("id", "owner_id", name="uq_idea_drafts_id_owner"),
    )


class KnowledgeSource(Base):
    __tablename__ = "knowledge_sources"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    vault_id: Mapped[str] = mapped_column(String(36), index=True)
    owner_id: Mapped[str] = mapped_column(String(36))
    title: Mapped[str] = mapped_column(String(100))
    body: Mapped[str] = mapped_column(String(12000))
    source_reference: Mapped[str] = mapped_column(String(500))
    sha256: Mapped[str] = mapped_column(String(64))
    approved_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(16), default="draft")
    __table_args__ = (
        ForeignKeyConstraint(
            ["vault_id", "owner_id"],
            ["project_vaults.id", "project_vaults.created_by"],
        ),
        CheckConstraint("status IN ('draft', 'approved', 'withdrawn')"),
        CheckConstraint("status <> 'approved' OR approved_by IS NOT NULL"),
    )


class ProjectExperiment(Base):
    __tablename__ = "project_experiments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    draft_id: Mapped[str] = mapped_column(String(36))
    owner_id: Mapped[str] = mapped_column(String(36))
    reformulates_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    question: Mapped[str] = mapped_column(String(2000))
    method: Mapped[str] = mapped_column(String(3000))
    success_criterion: Mapped[str] = mapped_column(String(3000))
    status: Mapped[str] = mapped_column(String(16), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(["draft_id", "owner_id"], ["idea_drafts.id", "idea_drafts.owner_id"]),
        ForeignKeyConstraint(
            ["reformulates_id", "owner_id"],
            ["project_experiments.id", "project_experiments.owner_id"],
        ),
        CheckConstraint("status IN ('draft', 'active', 'completed')", name="ck_experiment_status"),
        CheckConstraint(
            "status = 'draft' OR (length(trim(question)) > 0 "
            "AND length(trim(method)) > 0 AND length(trim(success_criterion)) > 0)",
            name="ck_experiment_active_fields",
        ),
        UniqueConstraint("id", "owner_id", name="uq_experiment_id_owner"),
        Index("ix_experiments_owner_draft", "owner_id", "draft_id"),
    )


class ExperimentResult(Base):
    __tablename__ = "experiment_results"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    experiment_id: Mapped[str] = mapped_column(String(36))
    owner_id: Mapped[str] = mapped_column(String(36))
    outcome: Mapped[str] = mapped_column(String(16))
    observations: Mapped[str] = mapped_column(String(5000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(
            ["experiment_id", "owner_id"],
            ["project_experiments.id", "project_experiments.owner_id"],
        ),
        CheckConstraint(
            "outcome IN ('supportive', 'unsupported', 'inconclusive')",
            name="ck_result_outcome",
        ),
        CheckConstraint("length(trim(observations)) > 0", name="ck_result_observation"),
        UniqueConstraint("id", "owner_id", name="uq_result_id_owner"),
        Index("ix_results_experiment", "owner_id", "experiment_id"),
    )


class ExperimentEvidence(Base):
    __tablename__ = "experiment_evidence"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    result_id: Mapped[str] = mapped_column(String(36))
    owner_id: Mapped[str] = mapped_column(String(36))
    reference: Mapped[str] = mapped_column(String(2000))
    source_note: Mapped[str] = mapped_column(String(2000))
    review_status: Mapped[str] = mapped_column(String(16), default="declared")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(
            ["result_id", "owner_id"], ["experiment_results.id", "experiment_results.owner_id"]
        ),
        CheckConstraint("review_status = 'declared'", name="ck_evidence_declared"),
        CheckConstraint("length(trim(reference)) > 0", name="ck_evidence_reference"),
        Index("ix_evidence_result", "owner_id", "result_id"),
    )


class ProjectDecision(Base):
    __tablename__ = "project_decisions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    draft_id: Mapped[str] = mapped_column(String(36))
    experiment_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    result_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    owner_id: Mapped[str] = mapped_column(String(36))
    choice: Mapped[str] = mapped_column(String(24))
    rationale: Mapped[str] = mapped_column(String(3000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(["draft_id", "owner_id"], ["idea_drafts.id", "idea_drafts.owner_id"]),
        ForeignKeyConstraint(
            ["experiment_id", "owner_id"],
            ["project_experiments.id", "project_experiments.owner_id"],
        ),
        ForeignKeyConstraint(
            ["result_id", "owner_id"],
            ["experiment_results.id", "experiment_results.owner_id"],
        ),
        CheckConstraint(
            "choice IN ('continue', 'reformulate', 'request_help', 'pause', 'close')",
            name="ck_project_decision_choice",
        ),
        CheckConstraint("length(trim(rationale)) > 0", name="ck_decision_rationale"),
        Index("ix_decisions_owner_draft", "owner_id", "draft_id"),
    )


class ProjectResourceIntent(Base):
    __tablename__ = "project_resource_intents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    draft_id: Mapped[str] = mapped_column(String(36))
    owner_id: Mapped[str] = mapped_column(String(36))
    kind: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(String(3000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(["draft_id", "owner_id"], ["idea_drafts.id", "idea_drafts.owner_id"]),
        CheckConstraint(
            "kind IN ('person', 'resources', 'funding')", name="ck_resource_intent_kind"
        ),
        CheckConstraint("length(trim(description)) > 0", name="ck_resource_description"),
        Index("ix_resource_intents_owner_draft", "owner_id", "draft_id"),
    )


class ProjectLifecycleEvent(Base):
    """Immutable, owner-scoped operational transition and review attestation."""

    __tablename__ = "project_lifecycle_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    draft_id: Mapped[str] = mapped_column(String(36))
    owner_id: Mapped[str] = mapped_column(String(36))
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    idempotency_key: Mapped[str] = mapped_column(String(36))
    request_hash: Mapped[str] = mapped_column(String(64))
    version: Mapped[int]
    action: Mapped[str] = mapped_column(String(12))
    previous_state: Mapped[str] = mapped_column(String(12))
    next_state: Mapped[str] = mapped_column(String(12))
    reason: Mapped[str] = mapped_column(String(3000))
    resume_conditions: Mapped[str] = mapped_column(String(3000), default="")
    review_note: Mapped[str] = mapped_column(String(3000))
    reviewed: Mapped[list[str]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(["draft_id", "owner_id"], ["idea_drafts.id", "idea_drafts.owner_id"]),
        CheckConstraint("action IN ('pause', 'close', 'resume', 'reopen')"),
        CheckConstraint("previous_state IN ('active', 'paused', 'closed')"),
        CheckConstraint("next_state IN ('active', 'paused', 'closed')"),
        CheckConstraint("version > 0"),
        UniqueConstraint("owner_id", "draft_id", "idempotency_key"),
        UniqueConstraint("draft_id", "version"),
        Index("ix_lifecycle_events_owner_draft", "owner_id", "draft_id"),
    )


class ProjectSuggestionFeedback(Base):
    """Append-only opt-in local project feedback, never training data."""

    __tablename__ = "project_suggestion_feedback"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    draft_id: Mapped[str] = mapped_column(String(36))
    owner_id: Mapped[str] = mapped_column(String(36))
    code: Mapped[str] = mapped_column(String(64))
    choice: Mapped[str] = mapped_column(String(12))
    consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(["draft_id", "owner_id"], ["idea_drafts.id", "idea_drafts.owner_id"]),
        CheckConstraint("choice IN ('dismiss', 'restore')"),
        Index("ix_feedback_owner_draft", "owner_id", "draft_id"),
    )


class IdentityFacet(Base):
    """Presentation preference; never a grant to any project."""

    __tablename__ = "identity_facets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    summary: Mapped[str] = mapped_column(String(500), default="")
    audience: Mapped[str] = mapped_column(String(20), default="private")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        CheckConstraint("kind IN ('creator','student','mentor','professional')"),
        CheckConstraint("audience = 'private'"),
        UniqueConstraint("user_id", "kind", name="uq_identity_facets_user_kind"),
        Index("ix_facets_user", "user_id"),
    )


class ShareableNeed(Base):
    """Projection deliberately separate from the owner-only parent draft."""

    __tablename__ = "shareable_needs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    draft_id: Mapped[str] = mapped_column(String(36), nullable=False)
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(String(1200), nullable=False)
    audience: Mapped[str] = mapped_column(String(20), default="private")
    state: Mapped[str] = mapped_column(String(20), default="draft")
    version: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(["draft_id", "owner_id"], ["idea_drafts.id", "idea_drafts.owner_id"]),
        CheckConstraint("state IN ('draft','published','revoked')"),
        CheckConstraint("audience IN ('private','authenticated','selected')"),
        CheckConstraint("version >= 0"),
        CheckConstraint("length(trim(title)) > 0"),
        CheckConstraint("length(trim(description)) > 0"),
        Index("ix_needs_owner_draft", "owner_id", "draft_id"),
        Index("ix_needs_discovery", "state", "audience"),
        UniqueConstraint("id", "owner_id", name="uq_shareable_need_owner"),
    )


class NeedPublicationEvent(Base):
    """Append-only publication / revocation audit, scoped to the owner."""

    __tablename__ = "need_publication_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    need_id: Mapped[str] = mapped_column(String(36), nullable=False)
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(12), nullable=False)
    version: Mapped[int] = mapped_column(nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        CheckConstraint("action IN ('publish','revoke')"),
        ForeignKeyConstraint(
            ["need_id", "owner_id"], ["shareable_needs.id", "shareable_needs.owner_id"]
        ),
        UniqueConstraint("need_id", "version"),
        Index("ix_need_events_owner", "owner_id", "need_id"),
    )


class NeedViewerGrant(Base):
    """An explicit per-recipient grant, never a project membership."""

    __tablename__ = "need_viewer_grants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    need_id: Mapped[str] = mapped_column(String(36), nullable=False)
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False)
    viewer_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(
            ["need_id", "owner_id"], ["shareable_needs.id", "shareable_needs.owner_id"]
        ),
        UniqueConstraint("need_id", "viewer_id", name="uq_need_viewer"),
        Index("ix_need_viewers_viewer", "viewer_id", "need_id"),
    )


class ConnectRequest(Base):
    """One lightweight consent request per published need and requester."""

    __tablename__ = "connect_requests"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    need_id: Mapped[str] = mapped_column(String(36), nullable=False)
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False)
    requester_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    note: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    version: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(
            ["need_id", "owner_id"], ["shareable_needs.id", "shareable_needs.owner_id"]
        ),
        CheckConstraint("status IN ('pending','accepted','declined','withdrawn')"),
        CheckConstraint("owner_id <> requester_id"),
        CheckConstraint("version >= 0"),
        CheckConstraint("length(trim(note)) > 0"),
        UniqueConstraint("need_id", "requester_id", name="uq_connect_need_requester"),
        UniqueConstraint(
            "id", "owner_id", "requester_id", name="uq_connect_request_participants"
        ),
        Index("ix_connect_requests_owner_status", "owner_id", "status"),
        Index("ix_connect_requests_requester_status", "requester_id", "status"),
    )


class ConnectEvent(Base):
    """Immutable acceptance, refusal and withdrawal evidence."""

    __tablename__ = "connect_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    request_id: Mapped[str] = mapped_column(String(36), nullable=False)
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False)
    requester_id: Mapped[str] = mapped_column(String(36), nullable=False)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(16), nullable=False)
    version: Mapped[int] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(
            ["request_id", "owner_id", "requester_id"],
            [
                "connect_requests.id", "connect_requests.owner_id",
                "connect_requests.requester_id",
            ],
        ),
        CheckConstraint("action IN ('requested','accepted','declined','withdrawn')"),
        UniqueConstraint("request_id", "version", name="uq_connect_event_version"),
        Index("ix_connect_events_request", "request_id", "version"),
    )
