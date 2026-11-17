import pytest
from alembic import command
from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from campus_api.config import Settings
from campus_api.db import make_engine
from campus_api.models import User, UserIdentity

from .conftest import migration_config


def test_existing_actor_keeps_membership_through_explicit_identity_mapping(api):
    space = api.space()
    original = api.request("GET", "/me").json()["id"]
    with Session(api.app.state.engine) as db:
        db.add(UserIdentity(auth_subject="https://test.local|new-provider", user_id=original))
        db.commit()
    try:
        assert api.request("GET", "/me", "new-provider").json()["id"] == original
        spaces = api.request("GET", "/spaces", "new-provider").json()
        assert space["id"] in [item["id"] for item in spaces]
        assert api.request("GET", "/spaces", "outsider").json() == []
    finally:
        with Session(api.app.state.engine) as db:
            db.execute(
                delete(UserIdentity).where(
                    UserIdentity.auth_subject == "https://test.local|new-provider"
                )
            )
            db.commit()


def test_legacy_seed_user_is_not_replaced(api):
    with Session(api.app.state.engine) as db:
        user = User(auth_subject="https://test.local|legacy", display_name="Existing")
        db.add(user)
        db.commit()
        original = user.id
    assert api.request("GET", "/me", "legacy").json()["id"] == original
    with Session(api.app.state.engine) as db:
        identity = db.scalar(select(UserIdentity).where(UserIdentity.user_id == original))
        assert identity.auth_subject == "https://test.local|legacy"


def test_migration_backfills_ids_and_guards_lossy_rollback(tmp_path):
    settings = Settings(database_url=f"sqlite:///{tmp_path / 'identity-migration.db'}")
    config = migration_config(settings)
    command.upgrade(config, "0013")
    engine = make_engine(settings)
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO users (id, auth_subject, display_name, created_at) "
                    "VALUES ('stable-id', 'issuer|original', 'Existing', CURRENT_TIMESTAMP)"
                )
            )
        command.upgrade(config, "0014")
        with engine.begin() as conn:
            assert (
                conn.execute(
                    text(
                        "SELECT user_id FROM user_identities WHERE auth_subject = 'issuer|original'"
                    )
                ).scalar_one()
                == "stable-id"
            )
            conn.execute(
                text(
                    "INSERT INTO user_identities (auth_subject, user_id, created_at) "
                    "VALUES ('issuer|additional', 'stable-id', CURRENT_TIMESTAMP)"
                )
            )
        with pytest.raises(RuntimeError, match="Reconcile additional"):
            command.downgrade(config, "0013")
        with engine.begin() as conn:
            assert conn.execute(text("SELECT COUNT(*) FROM user_identities")).scalar_one() == 2
            conn.execute(text("DELETE FROM user_identities WHERE auth_subject='issuer|additional'"))
        command.downgrade(config, "0013")
        command.upgrade(config, "head")
        with engine.connect() as conn:
            assert (
                conn.execute(text("SELECT user_id FROM user_identities")).scalar_one()
                == "stable-id"
            )
    finally:
        engine.dispose()
