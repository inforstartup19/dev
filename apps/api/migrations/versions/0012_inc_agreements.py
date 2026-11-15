"""Versioned bilateral agreements with independent actor confirmations.

Revision ID: 0012
Revises: 0011
"""

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "collaboration_agreements",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("request_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("requester_id", sa.String(36), nullable=False),
        sa.Column("current_version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("cancelled_by", sa.String(36), sa.ForeignKey("users.id")),
        sa.Column("cancelled_reason", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["request_id", "owner_id", "requester_id"],
            ["connect_requests.id", "connect_requests.owner_id",
             "connect_requests.requester_id"],
        ),
        sa.UniqueConstraint("request_id", name="uq_agreement_request"),
        sa.UniqueConstraint(
            "id", "owner_id", "requester_id", name="uq_agreement_participants"
        ),
        sa.CheckConstraint("current_version >= 1"),
        sa.CheckConstraint("status IN ('active', 'cancelled')"),
    )
    op.create_table(
        "agreement_revisions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("agreement_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("requester_id", sa.String(36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("terms", sa.JSON(), nullable=False),
        sa.Column("terms_sha256", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["agreement_id", "owner_id", "requester_id"],
            ["collaboration_agreements.id", "collaboration_agreements.owner_id",
             "collaboration_agreements.requester_id"],
        ),
        sa.UniqueConstraint("agreement_id", "version", name="uq_agreement_revision"),
        sa.CheckConstraint("version >= 1"),
    )
    op.create_table(
        "agreement_confirmations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("agreement_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("requester_id", sa.String(36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("terms_sha256", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["agreement_id", "owner_id", "requester_id"],
            ["collaboration_agreements.id", "collaboration_agreements.owner_id",
             "collaboration_agreements.requester_id"],
        ),
        sa.ForeignKeyConstraint(
            ["agreement_id", "version"],
            ["agreement_revisions.agreement_id", "agreement_revisions.version"],
        ),
        sa.UniqueConstraint(
            "agreement_id", "version", "actor_id", name="uq_agreement_confirmation"
        ),
        sa.CheckConstraint("version >= 1"),
    )
    op.create_index(
        "ix_agreements_owner", "collaboration_agreements", ["owner_id", "status"]
    )
    op.create_index(
        "ix_agreements_requester", "collaboration_agreements", ["requester_id", "status"]
    )
    if op.get_bind().dialect.name == "postgresql":
        actor = "NULLIF(current_setting('app.actor_id', true), '')"
        for table in (
            "collaboration_agreements",
            "agreement_revisions",
            "agreement_confirmations",
        ):
            op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
            op.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))
        for table in (
            "collaboration_agreements",
            "agreement_revisions",
            "agreement_confirmations",
        ):
            op.execute(sa.text(
                f"CREATE POLICY {table}_select ON {table} FOR SELECT "
                f"USING (owner_id = {actor} OR requester_id = {actor})"
            ))
        op.execute(sa.text(
            f"CREATE POLICY agreements_insert ON collaboration_agreements FOR INSERT "
            f"WITH CHECK (owner_id = {actor} OR requester_id = {actor})"
        ))
        op.execute(sa.text(
            f"CREATE POLICY agreements_update ON collaboration_agreements FOR UPDATE "
            f"USING (owner_id = {actor} OR requester_id = {actor}) "
            f"WITH CHECK (owner_id = {actor} OR requester_id = {actor})"
        ))
        for table in ("agreement_revisions", "agreement_confirmations"):
            op.execute(sa.text(
                f"CREATE POLICY {table}_insert ON {table} FOR INSERT "
                f"WITH CHECK ((owner_id = {actor} OR requester_id = {actor}) "
                f"AND actor_id = {actor})"
            ))
        exists = (
            op.get_bind()
            .execute(sa.text("SELECT 1 FROM pg_roles WHERE rolname = 'incfs_api'"))
            .scalar()
        )
        if exists:
            op.execute(sa.text(
                "GRANT SELECT, INSERT, UPDATE ON collaboration_agreements TO incfs_api"
            ))
            op.execute(sa.text(
                "GRANT SELECT, INSERT ON agreement_revisions, agreement_confirmations "
                "TO incfs_api"
            ))


def downgrade():
    op.drop_table("agreement_confirmations")
    op.drop_table("agreement_revisions")
    op.drop_index("ix_agreements_requester", table_name="collaboration_agreements")
    op.drop_index("ix_agreements_owner", table_name="collaboration_agreements")
    op.drop_table("collaboration_agreements")
