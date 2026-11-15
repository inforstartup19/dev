"""Independent identity facets and explicitly published need projections.

Revision ID: 0010
Revises: 0009
"""
import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "identity_facets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("summary", sa.String(500), nullable=False),
        sa.Column("audience", sa.String(20), nullable=False, server_default="private"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("kind IN ('creator','student','mentor','professional')"),
        sa.CheckConstraint("audience = 'private'"),
        sa.UniqueConstraint("user_id", "kind", name="uq_identity_facets_user_kind"),
    )
    op.create_index("ix_facets_user", "identity_facets", ["user_id"])
    op.create_table(
        "shareable_needs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("draft_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("description", sa.String(1200), nullable=False),
        sa.Column("audience", sa.String(20), nullable=False, server_default="private"),
        sa.Column("state", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("version", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["draft_id","owner_id"], ["idea_drafts.id","idea_drafts.owner_id"]
        ),
        sa.CheckConstraint("state IN ('draft','published','revoked')"),
        sa.CheckConstraint("audience IN ('private','authenticated')"),
        sa.CheckConstraint("version >= 0"),
        sa.CheckConstraint("length(trim(title)) > 0"),
        sa.CheckConstraint("length(trim(description)) > 0"),
        sa.UniqueConstraint("id", "owner_id", name="uq_shareable_need_owner"),
    )
    op.create_index("ix_needs_owner_draft", "shareable_needs", ["owner_id","draft_id"])
    op.create_index("ix_needs_discovery", "shareable_needs", ["state","audience"])
    op.create_table(
        "need_publication_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("need_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(12), nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("action IN ('publish','revoke')"),
        sa.ForeignKeyConstraint(["need_id", "owner_id"], ["shareable_needs.id", "shareable_needs.owner_id"]),
        sa.UniqueConstraint("need_id","version"),
    )
    op.create_index("ix_need_events_owner", "need_publication_events", ["owner_id","need_id"])
    if op.get_bind().dialect.name == "postgresql":
        actor = "NULLIF(current_setting('app.actor_id', true), '')"
        for table in ("identity_facets", "shareable_needs", "need_publication_events"):
            op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
            op.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))
        op.execute(sa.text(
            f"CREATE POLICY facets_select ON identity_facets FOR SELECT USING (user_id = {actor})"
        ))
        op.execute(sa.text(
            f"CREATE POLICY facets_insert ON identity_facets FOR INSERT WITH CHECK (user_id = {actor} AND audience = 'private')"
        ))
        op.execute(sa.text(
            f"CREATE POLICY facets_update ON identity_facets FOR UPDATE USING (user_id = {actor}) WITH CHECK (user_id = {actor} AND audience = 'private')"
        ))
        op.execute(sa.text(
            f"CREATE POLICY needs_select ON shareable_needs FOR SELECT USING "
            f"(owner_id = {actor} OR (state = 'published' AND audience = 'authenticated' AND {actor} IS NOT NULL))"
        ))
        op.execute(sa.text(
            f"CREATE POLICY needs_insert ON shareable_needs FOR INSERT WITH CHECK "
            f"(owner_id = {actor} AND state = 'draft' AND audience = 'private' AND version = 0)"
        ))
        op.execute(sa.text(
            f"CREATE POLICY needs_update ON shareable_needs FOR UPDATE USING (owner_id = {actor}) "
            f"WITH CHECK (owner_id = {actor})"
        ))
        op.execute(sa.text(
            f"CREATE POLICY need_events_select ON need_publication_events FOR SELECT USING (owner_id = {actor})"
        ))
        op.execute(sa.text(
            f"CREATE POLICY need_events_insert ON need_publication_events FOR INSERT "
            f"WITH CHECK (owner_id = {actor} AND actor_id = {actor})"
        ))
        op.execute(sa.text("""DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='incfs_api') THEN
                GRANT SELECT, INSERT, UPDATE ON identity_facets, shareable_needs TO incfs_api;
                GRANT SELECT, INSERT ON need_publication_events TO incfs_api;
            END IF;
        END $$"""))


def downgrade():
    op.drop_index("ix_need_events_owner", table_name="need_publication_events")
    op.drop_table("need_publication_events")
    op.drop_index("ix_needs_discovery", table_name="shareable_needs")
    op.drop_index("ix_needs_owner_draft", table_name="shareable_needs")
    op.drop_table("shareable_needs")
    op.drop_index("ix_facets_user", table_name="identity_facets")
    op.drop_table("identity_facets")
