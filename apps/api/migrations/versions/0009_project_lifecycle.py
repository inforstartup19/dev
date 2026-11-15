"""Operational lifecycle for private idea drafts.

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    # SQLite batch-recreate would rewrite FK targets held by 0007/0008 tables.
    # ADD COLUMN is safe on both dialects; PostgreSQL adds DB constraints.
    op.add_column(
        "idea_drafts",
        sa.Column("lifecycle_state", sa.String(12), nullable=False, server_default="active"),
    )
    op.add_column(
        "idea_drafts",
        sa.Column("lifecycle_version", sa.Integer(), nullable=False, server_default="0"),
    )
    if op.get_bind().dialect.name == "postgresql":
        op.create_check_constraint(
            "ck_idea_drafts_lifecycle",
            "idea_drafts",
            "lifecycle_state IN ('active', 'paused', 'closed')",
        )
        op.create_check_constraint(
            "ck_idea_drafts_lifecycle_version",
            "idea_drafts",
            "lifecycle_version >= 0",
        )
    op.create_table(
        "project_lifecycle_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("draft_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("idempotency_key", sa.String(36), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(12), nullable=False),
        sa.Column("previous_state", sa.String(12), nullable=False),
        sa.Column("next_state", sa.String(12), nullable=False),
        sa.Column("reason", sa.String(3000), nullable=False),
        sa.Column("resume_conditions", sa.String(3000), nullable=False),
        sa.Column("review_note", sa.String(3000), nullable=False),
        sa.Column("reviewed", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["draft_id", "owner_id"], ["idea_drafts.id", "idea_drafts.owner_id"]
        ),
        sa.CheckConstraint("action IN ('pause', 'close', 'resume', 'reopen')"),
        sa.CheckConstraint("previous_state IN ('active', 'paused', 'closed')"),
        sa.CheckConstraint("next_state IN ('active', 'paused', 'closed')"),
        sa.CheckConstraint("version > 0"),
        sa.UniqueConstraint("owner_id", "draft_id", "idempotency_key"),
        sa.UniqueConstraint("draft_id", "version"),
    )
    op.create_index(
        "ix_lifecycle_events_owner_draft",
        "project_lifecycle_events",
        ["owner_id", "draft_id"],
    )
    op.create_table(
        "project_suggestion_feedback",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("draft_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("choice", sa.String(12), nullable=False),
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["draft_id", "owner_id"], ["idea_drafts.id", "idea_drafts.owner_id"]
        ),
        sa.CheckConstraint("choice IN ('dismiss', 'restore')"),
    )
    op.create_index(
        "ix_feedback_owner_draft",
        "project_suggestion_feedback",
        ["owner_id", "draft_id"],
    )
    if op.get_bind().dialect.name == "postgresql":
        actor = "NULLIF(current_setting('app.actor_id', true), '')"
        op.execute(sa.text("ALTER TABLE project_suggestion_feedback ENABLE ROW LEVEL SECURITY"))
        op.execute(sa.text("ALTER TABLE project_suggestion_feedback FORCE ROW LEVEL SECURITY"))
        op.execute(
            sa.text(
                "CREATE POLICY feedback_select ON project_suggestion_feedback "
                f"FOR SELECT USING (owner_id = {actor})"
            )
        )
        op.execute(
            sa.text(
                "CREATE POLICY feedback_insert ON project_suggestion_feedback "
                f"FOR INSERT WITH CHECK (owner_id = {actor})"
            )
        )
        op.execute(
            sa.text(
                """DO $ BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'incfs_api') THEN
                    GRANT SELECT, INSERT ON project_suggestion_feedback TO incfs_api;
                END IF;
                END $"""
            )
        )
        op.execute(sa.text("ALTER TABLE project_lifecycle_events ENABLE ROW LEVEL SECURITY"))
        op.execute(sa.text("ALTER TABLE project_lifecycle_events FORCE ROW LEVEL SECURITY"))
        op.execute(
            sa.text(
                "CREATE POLICY lifecycle_select ON project_lifecycle_events "
                f"FOR SELECT USING (owner_id = {actor})"
            )
        )
        op.execute(
            sa.text(
                "CREATE POLICY lifecycle_insert ON project_lifecycle_events "
                f"FOR INSERT WITH CHECK (owner_id = {actor} AND actor_id = {actor})"
            )
        )
        op.execute(
            sa.text(
                """DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'incfs_api') THEN
                    GRANT SELECT, INSERT ON project_lifecycle_events TO incfs_api;
                END IF;
                END $$"""
            )
        )


def downgrade():
    op.drop_index("ix_feedback_owner_draft", table_name="project_suggestion_feedback")
    op.drop_table("project_suggestion_feedback")
    op.drop_index("ix_lifecycle_events_owner_draft", table_name="project_lifecycle_events")
    op.drop_table("project_lifecycle_events")
    if op.get_bind().dialect.name == "postgresql":
        op.drop_constraint(
            "ck_idea_drafts_lifecycle_version", "idea_drafts", type_="check"
        )
        op.drop_constraint("ck_idea_drafts_lifecycle", "idea_drafts", type_="check")
    op.drop_column("idea_drafts", "lifecycle_version")
    op.drop_column("idea_drafts", "lifecycle_state")
