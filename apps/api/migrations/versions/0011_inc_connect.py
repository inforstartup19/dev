"""Consented connection requests for a published need; no project ACL grants.

Revision ID: 0011
Revises: 0010
"""

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "connect_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("need_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("requester_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("note", sa.String(500), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["need_id", "owner_id"], ["shareable_needs.id", "shareable_needs.owner_id"]
        ),
        sa.CheckConstraint("status IN ('pending','accepted','declined','withdrawn')"),
        sa.CheckConstraint("owner_id <> requester_id"),
        sa.CheckConstraint("version >= 0"),
        sa.CheckConstraint("length(trim(note)) > 0"),
        sa.UniqueConstraint("need_id", "requester_id", name="uq_connect_need_requester"),
        sa.UniqueConstraint(
            "id", "owner_id", "requester_id", name="uq_connect_request_participants"
        ),
    )
    op.create_index("ix_connect_requests_owner_status", "connect_requests", ["owner_id", "status"])
    op.create_index(
        "ix_connect_requests_requester_status", "connect_requests", ["requester_id", "status"]
    )
    op.create_table(
        "connect_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("request_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("requester_id", sa.String(36), nullable=False),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["request_id", "owner_id", "requester_id"],
            ["connect_requests.id", "connect_requests.owner_id", "connect_requests.requester_id"],
        ),
        sa.CheckConstraint("action IN ('requested','accepted','declined','withdrawn')"),
        sa.UniqueConstraint("request_id", "version", name="uq_connect_event_version"),
    )
    op.create_index("ix_connect_events_request", "connect_events", ["request_id", "version"])
    if op.get_bind().dialect.name == "postgresql":
        actor = "NULLIF(current_setting('app.actor_id', true), '')"
        for table in ("connect_requests", "connect_events"):
            op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
            op.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))
        op.execute(
            sa.text(
                f"CREATE POLICY connect_request_select ON connect_requests FOR SELECT "
                f"USING (owner_id = {actor} OR requester_id = {actor})"
            )
        )
        op.execute(
            sa.text(
                f"CREATE POLICY connect_request_insert ON connect_requests FOR INSERT "
                f"WITH CHECK (requester_id = {actor} AND owner_id <> requester_id "
                f"AND status = 'pending' AND version = 0 "
                f"AND EXISTS (SELECT 1 FROM shareable_needs n WHERE n.id = need_id "
                f"AND n.owner_id = connect_requests.owner_id AND n.state = 'published' "
                f"AND (n.audience = 'authenticated' OR "
                f"(n.audience = 'selected' AND EXISTS (SELECT 1 FROM need_viewer_grants g "
                f"WHERE g.need_id = n.id AND g.viewer_id = {actor})))))"
            )
        )
        op.execute(
            sa.text(
                f"CREATE POLICY connect_request_update ON connect_requests FOR UPDATE "
                f"USING (owner_id = {actor} OR requester_id = {actor}) "
                f"WITH CHECK (owner_id = {actor} OR requester_id = {actor})"
            )
        )
        op.execute(
            sa.text(
                f"CREATE POLICY connect_event_select ON connect_events FOR SELECT "
                f"USING (owner_id = {actor} OR requester_id = {actor})"
            )
        )
        op.execute(
            sa.text(
                f"CREATE POLICY connect_event_insert ON connect_events FOR INSERT "
                f"WITH CHECK ((owner_id = {actor} OR requester_id = {actor}) "
                f"AND actor_id = {actor})"
            )
        )
        role_exists = (
            op.get_bind()
            .execute(sa.text("SELECT 1 FROM pg_roles WHERE rolname = 'incfs_api'"))
            .scalar()
        )
        if role_exists:
            op.execute(sa.text("GRANT SELECT, INSERT, UPDATE ON connect_requests TO incfs_api"))
            op.execute(sa.text("GRANT SELECT, INSERT ON connect_events TO incfs_api"))


def downgrade():
    op.drop_index("ix_connect_events_request", table_name="connect_events")
    op.drop_table("connect_events")
    op.drop_index("ix_connect_requests_requester_status", table_name="connect_requests")
    op.drop_index("ix_connect_requests_owner_status", table_name="connect_requests")
    op.drop_table("connect_requests")
