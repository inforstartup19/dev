"""Owner/participant-scoped contribution records with versioned private evidence.

Revision ID: 0013
Revises: 0012
"""

import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "proof_contributions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("agreement_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("requester_id", sa.String(36), nullable=False),
        sa.Column("declared_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("agreement_version", sa.Integer(), nullable=False),
        sa.Column("agreement_hash", sa.String(64), nullable=False),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("summary", sa.String(1200), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("state", sa.String(12), nullable=False),
        sa.Column("withdrawn_by", sa.String(36), sa.ForeignKey("users.id")),
        sa.Column("withdrawal_reason", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["agreement_id", "owner_id", "requester_id"],
            ["collaboration_agreements.id", "collaboration_agreements.owner_id",
             "collaboration_agreements.requester_id"],
        ),
        sa.UniqueConstraint(
            "id", "owner_id", "requester_id", name="uq_proof_participants"
        ),
        sa.CheckConstraint("kind IN ('work','knowledge','resource','other')"),
        sa.CheckConstraint("state IN ('active','withdrawn')"),
        sa.CheckConstraint("length(trim(summary)) > 0"),
        sa.CheckConstraint("agreement_version >= 1 AND version >= 1"),
    )
    op.create_index(
        "ix_proof_owner_agreement", "proof_contributions", ["owner_id", "agreement_id"]
    )
    op.create_index(
        "ix_proof_requester_agreement", "proof_contributions",
        ["requester_id", "agreement_id"],
    )
    op.create_table(
        "proof_evidence",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("contribution_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("requester_id", sa.String(36), nullable=False),
        sa.Column("declared_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("proof_version", sa.Integer(), nullable=False),
        sa.Column("origin", sa.String(16), nullable=False),
        sa.Column("source_reference", sa.String(500), nullable=False),
        sa.Column("source_version", sa.String(100), nullable=False),
        sa.Column("provenance", sa.String(1000), nullable=False),
        sa.Column("rights_note", sa.String(500), nullable=False),
        sa.Column("review_state", sa.String(12), nullable=False),
        sa.Column("audience", sa.String(12), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["contribution_id", "owner_id", "requester_id"],
            ["proof_contributions.id", "proof_contributions.owner_id",
             "proof_contributions.requester_id"],
        ),
        sa.CheckConstraint("origin IN ('self','experiment','external')"),
        sa.CheckConstraint("review_state = 'declared'"),
        sa.CheckConstraint("audience = 'private'"),
        sa.CheckConstraint("proof_version > 1"),
    )
    op.create_index(
        "ix_proof_evidence_version", "proof_evidence",
        ["contribution_id", "proof_version"],
    )
    op.create_table(
        "proof_attestations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("contribution_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("requester_id", sa.String(36), nullable=False),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("proof_version", sa.Integer(), nullable=False),
        sa.Column("decision", sa.String(12), nullable=False),
        sa.Column("note", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["contribution_id", "owner_id", "requester_id"],
            ["proof_contributions.id", "proof_contributions.owner_id",
             "proof_contributions.requester_id"],
        ),
        sa.UniqueConstraint(
            "contribution_id", "proof_version", "actor_id",
            name="uq_proof_attestation_actor_version",
        ),
        sa.CheckConstraint("decision IN ('confirm','dispute')"),
        sa.CheckConstraint("proof_version >= 1"),
    )
    op.create_index(
        "ix_proof_attestations_version", "proof_attestations",
        ["contribution_id", "proof_version"],
    )
    if op.get_bind().dialect.name == "postgresql":
        actor = "NULLIF(current_setting('app.actor_id', true), '')"
        tables = ("proof_contributions", "proof_evidence", "proof_attestations")
        for table in tables:
            op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
            op.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))
            op.execute(
                sa.text(
                    f"CREATE POLICY {table}_select ON {table} FOR SELECT "
                    f"USING (owner_id = {actor} OR requester_id = {actor})"
                )
            )
        op.execute(
            sa.text(
                f"CREATE POLICY proof_insert ON proof_contributions FOR INSERT "
                f"WITH CHECK ((owner_id = {actor} OR requester_id = {actor}) "
                f"AND declared_by = {actor} AND state = 'active' AND version = 1)"
            )
        )
        op.execute(
            sa.text(
                f"CREATE POLICY proof_update ON proof_contributions FOR UPDATE "
                f"USING (owner_id = {actor} OR requester_id = {actor}) "
                f"WITH CHECK (owner_id = {actor} OR requester_id = {actor})"
            )
        )
        for table in ("proof_evidence", "proof_attestations"):
            who = "declared_by" if table == "proof_evidence" else "actor_id"
            op.execute(
                sa.text(
                    f"CREATE POLICY {table}_insert ON {table} FOR INSERT "
                    f"WITH CHECK ((owner_id = {actor} OR requester_id = {actor}) "
                    f"AND {who} = {actor})"
                )
            )
        exists = (
            op.get_bind()
            .execute(sa.text("SELECT 1 FROM pg_roles WHERE rolname = 'incfs_api'"))
            .scalar()
        )
        if exists:
            op.execute(
                sa.text(
                    "GRANT SELECT, INSERT, UPDATE ON proof_contributions TO incfs_api"
                )
            )
            op.execute(
                sa.text(
                    "GRANT SELECT, INSERT ON proof_evidence, proof_attestations TO incfs_api"
                )
            )


def downgrade():
    op.drop_index("ix_proof_attestations_version", table_name="proof_attestations")
    op.drop_table("proof_attestations")
    op.drop_index("ix_proof_evidence_version", table_name="proof_evidence")
    op.drop_table("proof_evidence")
    op.drop_index("ix_proof_requester_agreement", table_name="proof_contributions")
    op.drop_index("ix_proof_owner_agreement", table_name="proof_contributions")
    op.drop_table("proof_contributions")
