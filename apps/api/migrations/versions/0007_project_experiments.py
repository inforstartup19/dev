"""Private experiments, immutable results and declared evidence.

Revision ID: 0007
Revises: 0006
"""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def _rls(table):
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
    # No UPDATE/DELETE policies for the immutable result and evidence records.
    if table == "project_experiments":
        op.execute(
            sa.text(
                f"CREATE POLICY {table}_update ON {table} FOR UPDATE "
                f"USING (owner_id = {actor}) WITH CHECK (owner_id = {actor})"
            )
        )
    grant = "SELECT, INSERT, UPDATE" if table == "project_experiments" else "SELECT, INSERT"
    op.execute(
        sa.text(
            f"""DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'incfs_api') THEN
                    GRANT {grant}
                    ON {table} TO incfs_api;
                END IF;
            END $$"""
        )
    )


def upgrade():
    with op.batch_alter_table("idea_drafts") as batch:
        batch.create_unique_constraint("uq_idea_drafts_id_owner", ["id", "owner_id"])
    op.create_table(
        "project_experiments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("draft_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("question", sa.String(2000), nullable=False),
        sa.Column("method", sa.String(3000), nullable=False),
        sa.Column("success_criterion", sa.String(3000), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["draft_id", "owner_id"], ["idea_drafts.id", "idea_drafts.owner_id"]
        ),
        sa.CheckConstraint("status IN ('active', 'completed')", name="ck_experiment_status"),
        sa.CheckConstraint("length(trim(question)) > 0", name="ck_experiment_question"),
        sa.UniqueConstraint("id", "owner_id", name="uq_experiment_id_owner"),
    )
    op.create_index("ix_experiments_owner_draft", "project_experiments", ["owner_id", "draft_id"])
    op.create_table(
        "experiment_results",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("experiment_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("outcome", sa.String(16), nullable=False),
        sa.Column("observations", sa.String(5000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["experiment_id", "owner_id"],
            ["project_experiments.id", "project_experiments.owner_id"],
        ),
        sa.CheckConstraint(
            "outcome IN ('supportive', 'unsupported', 'inconclusive')",
            name="ck_result_outcome",
        ),
        sa.CheckConstraint("length(trim(observations)) > 0", name="ck_result_observation"),
        sa.UniqueConstraint("id", "owner_id", name="uq_result_id_owner"),
    )
    op.create_index("ix_results_experiment", "experiment_results", ["owner_id", "experiment_id"])
    op.create_table(
        "experiment_evidence",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("result_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("reference", sa.String(2000), nullable=False),
        sa.Column("source_note", sa.String(2000), nullable=False),
        sa.Column("review_status", sa.String(16), nullable=False, server_default="declared"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["result_id", "owner_id"], ["experiment_results.id", "experiment_results.owner_id"]
        ),
        sa.CheckConstraint("review_status = 'declared'", name="ck_evidence_declared"),
        sa.CheckConstraint("length(trim(reference)) > 0", name="ck_evidence_reference"),
    )
    op.create_index("ix_evidence_result", "experiment_evidence", ["owner_id", "result_id"])
    if op.get_bind().dialect.name == "postgresql":
        for table in ("project_experiments", "experiment_results", "experiment_evidence"):
            _rls(table)


def downgrade():
    op.drop_index("ix_evidence_result", table_name="experiment_evidence")
    op.drop_table("experiment_evidence")
    op.drop_index("ix_results_experiment", table_name="experiment_results")
    op.drop_table("experiment_results")
    op.drop_index("ix_experiments_owner_draft", table_name="project_experiments")
    op.drop_table("project_experiments")
    with op.batch_alter_table("idea_drafts") as batch:
        batch.drop_constraint("uq_idea_drafts_id_owner", type_="unique")
