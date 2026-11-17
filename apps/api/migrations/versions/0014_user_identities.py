"""Preserve internal actors behind verified external identities.

Revision ID: 0014
Revises: 0013
"""

import sqlalchemy as sa
from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user_identities",
        sa.Column("auth_subject", sa.String(1024), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_user_identities_user_id", "user_identities", ["user_id"])
    op.execute(
        "INSERT INTO user_identities (auth_subject, user_id, created_at) "
        "SELECT auth_subject, id, created_at FROM users"
    )


def downgrade():
    # Losing an additional identity could lock a user out. Require reconciliation first.
    connection = op.get_bind()
    extra = connection.execute(
        sa.text(
            "SELECT COUNT(*) FROM user_identities i JOIN users u ON u.id = i.user_id "
            "WHERE i.auth_subject <> u.auth_subject"
        )
    ).scalar_one()
    if extra:
        raise RuntimeError("Reconcile additional user identities before downgrading 0014")
    op.drop_index("ix_user_identities_user_id", table_name="user_identities")
    op.drop_table("user_identities")
