"""Append-only Projecte Viu decisions and voluntary resource intents.

Revision ID: 0008
Revises: 0007
"""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def private_rls(table):
    actor = "NULLIF(current_setting('app.actor_id', true), '')"
    op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
    op.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))
    op.execute(
        sa.text(f"CREATE POLICY {table}_select ON {table} FOR SELECT USING (owner_id = {actor})")
    )
    op.execute(
        sa.text(
            f"CREATE POLICY {table}_insert ON {table} FOR INSERT WITH CHECK (owner_id = {actor})"
        )
    )
    op.execute(
        sa.text(
            f"""DO $$ BEGIN
              IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'incfs_api') THEN
                GRANT SELECT, INSERT ON {table} TO incfs_api;
              END IF;
            END $$"""
        )
    )


def upgrade():
    op.create_table(
        "project_decisions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("draft_id", sa.String(36), nullable=False),
        sa.Column("experiment_id", sa.String(36), nullable=True),
        sa.Column("result_id", sa.String(36), nullable=True),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("choice", sa.String(24), nullable=False),
        sa.Column("rationale", sa.String(3000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["draft_id", "owner_id"], ["idea_drafts.id", "idea_drafts.owner_id"]
        ),
        sa.ForeignKeyConstraint(
            ["experiment_id", "owner_id"],
            ["project_experiments.id", "project_experiments.owner_id"],
        ),
        sa.ForeignKeyConstraint(
            ["result_id", "owner_id"],
            ["experiment_results.id", "experiment_results.owner_id"],
        ),
        sa.CheckConstraint(
            "choice IN ('continue', 'reformulate', 'request_help', 'pause', 'close')",
            name="ck_project_decision_choice",
        ),
        sa.CheckConstraint("length(trim(rationale)) > 0", name="ck_decision_rationale"),
    )
    op.create_index("ix_decisions_owner_draft", "project_decisions", ["owner_id", "draft_id"])
    op.create_table(
        "project_resource_intents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("draft_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("description", sa.String(3000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["draft_id", "owner_id"], ["idea_drafts.id", "idea_drafts.owner_id"]
        ),
        sa.CheckConstraint(
            "kind IN ('person', 'resources', 'funding')", name="ck_resource_intent_kind"
        ),
        sa.CheckConstraint("length(trim(description)) > 0", name="ck_resource_description"),
    )
    op.create_index(
        "ix_resource_intents_owner_draft", "project_resource_intents", ["owner_id", "draft_id"]
    )
    if op.get_bind().dialect.name == "postgresql":
        for table in ("project_decisions", "project_resource_intents"):
            private_rls(table)


def downgrade():
    op.drop_index("ix_resource_intents_owner_draft", table_name="project_resource_intents")
    op.drop_table("project_resource_intents")
    op.drop_index("ix_decisions_owner_draft", table_name="project_decisions")
    op.drop_table("project_decisions")
