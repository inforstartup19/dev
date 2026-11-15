"""BF A/B/C boundary: published need != project access, with revocation and audit."""

from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from campus_api.db import bind_actor


def test_facets_have_no_project_permissions(api):
    bf = api.request(
        "POST",
        "/idea-drafts",
        "alice",
        json={
            "question": "Com validem BF90?",
            "name": "BF — privat",
            "intention": "Peça única 1-of-1",
        },
    )
    assert bf.status_code == 201, bf.text
    draft_id = bf.json()["id"]
    for actor, kind in (("alice", "creator"), ("bob", "professional"), ("charlie", "student")):
        created = api.request(
            "POST",
            "/me/facets",
            actor,
            json={
                "kind": kind,
                "summary": f"Faceta {kind}",
            },
        )
        assert created.status_code == 200, created.text
        assert created.json()["audience"] == "private"
        assert [r["kind"] for r in api.request("GET", "/me/facets", actor).json()] == [kind]
    changed = api.request(
        "POST",
        "/me/facets",
        "alice",
        json={
            "kind": "creator",
            "summary": "Nou perfil",
        },
    )
    assert changed.status_code == 200
    assert len(api.request("GET", "/me/facets", "alice").json()) == 1
    for outsider in ("bob", "charlie"):
        assert api.request("GET", f"/idea-drafts/{draft_id}", outsider).status_code == 404
        assert api.request("GET", "/idea-drafts", outsider).json() == []
    assert (
        api.request(
            "POST",
            "/me/facets",
            "alice",
            json={
                "kind": "creator",
                "audience": "authenticated",
            },
        ).status_code
        == 422
    )
    assert (
        api.request(
            "POST",
            "/me/facets",
            "alice",
            json={
                "kind": "admin",
            },
        ).status_code
        == 422
    )


def test_bf_explicit_projection_and_revocation(api):
    bf = api.request(
        "POST",
        "/idea-drafts",
        "alice",
        json={
            "question": "Podem fabricar una peça exclusiva?",
            "name": "BF — secret commercial",
            "intention": "Pressupost reservat",
            "next_test": "Proveïdor confidential",
        },
    )
    assert bf.status_code == 201
    draft_id = bf.json()["id"]
    path = f"/idea-drafts/{draft_id}/shared-needs"
    need = api.request(
        "POST",
        path,
        "alice",
        json={
            "title": "Col·laboració de confecció",
            "description": "Busquem un taller per validar una peça única 1-of-1.",
        },
    )
    assert need.status_code == 201, need.text
    record = need.json()
    need_id = record["id"]
    assert record["state"] == "draft"
    assert record["audience"] == "private"
    assert "owner_id" not in record and "draft_id" not in record
    assert api.request("GET", "/shared-needs", "bob").json() == []
    assert api.request("GET", f"/shared-needs/{need_id}", "bob").status_code == 404
    assert api.request("GET", path, "bob").status_code == 404
    assert (
        api.request(
            "POST",
            path,
            "bob",
            json={
                "title": "Forjat",
                "description": "Necessitat aliena",
            },
        ).status_code
        == 404
    )
    assert (
        api.request(
            "POST",
            path,
            "alice",
            json={
                "title": "Publicat!",
                "description": "No",
                "state": "published",
            },
        ).status_code
        == 422
    )
    publish_path = f"{path}/{need_id}/publish"
    assert (
        api.request(
            "POST",
            publish_path,
            "alice",
            json={
                "expected_version": 0,
                "confirm": False,
                "reason": "Sense confirmació",
            },
        ).status_code
        == 422
    )
    published = api.request(
        "POST",
        publish_path,
        "alice",
        json={
            "expected_version": 0,
            "confirm": True,
            "audience": "authenticated",
            "reason": "Compartir només la necessitat autoritzada",
        },
    )
    assert published.status_code == 200, published.text
    assert published.json()["version"] == 1
    assert published.json()["state"] == "published"
    for outsider in ("bob", "charlie"):
        items = api.request("GET", "/shared-needs", outsider).json()
        assert len(items) == 1
        assert items[0]["id"] == need_id
        assert "BF — secret" not in str(items)
        assert "Pressupost" not in str(items)
        assert "Proveïdor" not in str(items)
        assert "draft_id" not in str(items) and "owner_id" not in str(items)
        assert api.request("GET", f"/shared-needs/{need_id}", outsider).status_code == 200
        assert api.request("GET", f"/idea-drafts/{draft_id}", outsider).status_code == 404
        assert api.request("GET", path, outsider).status_code == 404
        assert (
            api.request(
                "POST",
                publish_path,
                outsider,
                json={
                    "expected_version": 1,
                    "confirm": True,
                    "reason": "Escalar",
                },
            ).status_code
            == 404
        )
    assert (
        api.request(
            "POST",
            publish_path,
            "alice",
            json={
                "expected_version": 0,
                "confirm": True,
                "reason": "Duplicat",
            },
        ).status_code
        == 409
    )
    assert (
        api.request(
            "POST",
            f"{path}/{need_id}/revoke",
            "bob",
            json={
                "expected_version": 1,
                "confirm": True,
                "reason": "No autoritzat",
            },
        ).status_code
        == 404
    )
    revoked = api.request(
        "POST",
        f"{path}/{need_id}/revoke",
        "alice",
        json={
            "expected_version": 1,
            "confirm": True,
            "reason": "Ja tenim taller",
        },
    )
    assert revoked.status_code == 200, revoked.text
    assert revoked.json()["state"] == "revoked"
    assert api.request("GET", "/shared-needs", "bob").json() == []
    assert api.request("GET", f"/shared-needs/{need_id}", "charlie").status_code == 404
    assert (
        api.request(
            "POST",
            publish_path,
            "alice",
            json={
                "expected_version": 2,
                "confirm": True,
                "reason": "Reobrim?",
            },
        ).status_code
        == 409
    )
    events = api.request("GET", f"{path}/{need_id}/events", "alice")
    assert events.status_code == 200
    assert [(e["action"], e["version"]) for e in events.json()] == [
        ("publish", 1),
        ("revoke", 2),
    ]
    assert api.request("GET", f"{path}/{need_id}/events", "bob").status_code == 404


def test_publish_blocked_when_project_paused(api):
    parent = api.request("POST", "/idea-drafts", "alice", json={"question": "BF pilot"}).json()
    base = f"/idea-drafts/{parent['id']}/shared-needs"
    need = api.request(
        "POST",
        base,
        "alice",
        json={
            "title": "Ajudes",
            "description": "Taller especialitzat",
        },
    ).json()
    stopped = api.request(
        "POST",
        f"/idea-drafts/{parent['id']}/lifecycle/transitions",
        "alice",
        json={
            "idempotency_key": str(uuid4()),
            "expected_version": 0,
            "action": "pause",
            "reason": "Revisió",
            "resume_conditions": "Nou acord",
            "review_note": "Sense compromisos",
            "reviewed": ["experiments", "participants", "agreements"],
        },
    )
    assert stopped.status_code == 201, stopped.text
    result = api.request(
        "POST",
        f"{base}/{need['id']}/publish",
        "alice",
        json={"expected_version": 0, "confirm": True, "reason": "Publicar"},
    )
    assert result.status_code == 409


def test_new_tables_have_forced_rls(api):
    if api.app.state.engine.dialect.name != "postgresql":
        return
    with api.app.state.engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class "
                "WHERE relname IN ('identity_facets','shareable_needs','need_publication_events')"
            )
        ).all()
    assert len(rows) == 3
    assert all(enabled and forced for _, enabled, forced in rows)


def test_postgres_direct_query_does_not_bypass_need_rls(protected_api):
    api, limited, admin = protected_api
    role = limited.url.username
    with admin.begin() as conn:
        conn.execute(
            text(
                f"GRANT SELECT, INSERT, UPDATE, DELETE ON identity_facets, "
                f"shareable_needs, need_publication_events, idea_drafts TO {role}"
            )
        )
    bob = api.request("GET", "/me", "bob").json()["id"]
    bf = api.request("POST", "/idea-drafts", "alice", json={"question": "BF privat"})
    assert bf.status_code == 201, bf.text
    base = f"/idea-drafts/{bf.json()['id']}/shared-needs"
    prepared = api.request(
        "POST",
        base,
        "alice",
        json={
            "title": "Taller",
            "description": "Peça 1-of-1",
        },
    )
    assert prepared.status_code == 201, prepared.text
    need_id = prepared.json()["id"]
    with Session(limited) as db:
        bind_actor(db, bob)
        assert db.execute(text("SELECT id FROM shareable_needs")).all() == []
        assert db.execute(text("SELECT id FROM idea_drafts")).all() == []
    published = api.request(
        "POST",
        f"{base}/{need_id}/publish",
        "alice",
        json={
            "expected_version": 0,
            "confirm": True,
            "audience": "authenticated",
            "reason": "Validació explícita",
        },
    )
    assert published.status_code == 200, published.text
    with Session(limited) as db:
        bind_actor(db, bob)
        assert db.execute(text("SELECT id FROM shareable_needs")).scalars().all() == [need_id]
        assert db.execute(text("SELECT id FROM idea_drafts")).all() == []
        assert (
            db.execute(
                text("UPDATE shareable_needs SET description='Tampered' WHERE id=:id"),
                {"id": need_id},
            ).rowcount
            == 0
        )
        assert db.execute(text("SELECT id FROM need_publication_events")).all() == []
        db.rollback()
    api.request(
        "POST",
        f"{base}/{need_id}/revoke",
        "alice",
        json={
            "expected_version": 1,
            "confirm": True,
            "reason": "Revocar",
        },
    )
    with Session(limited) as db:
        bind_actor(db, bob)
        assert db.execute(text("SELECT id FROM shareable_needs")).all() == []


def test_selected_audience_b_visible_c_denied_and_revoked(api):
    alice = api.request("GET", "/me", "alice").json()["id"]
    bob = api.request("GET", "/me", "bob").json()["id"]
    api.request("GET", "/me", "charlie")
    assert alice != bob
    bf = api.request(
        "POST",
        "/idea-drafts",
        "alice",
        json={
            "question": "BF: taller privat?",
            "intention": "Cost intern secret",
        },
    )
    assert bf.status_code == 201
    root = f"/idea-drafts/{bf.json()['id']}/shared-needs"
    item = api.request(
        "POST",
        root,
        "alice",
        json={
            "title": "Peça exclusiva",
            "description": "Busquem un taller de confecció",
        },
    ).json()
    nid = item["id"]
    path = f"{root}/{nid}"
    before = api.request(
        "POST",
        path + "/publish",
        "alice",
        json={
            "expected_version": 0,
            "confirm": True,
            "reason": "Sense cap destinatari",
            "audience": "selected",
        },
    )
    assert before.status_code == 422
    grant = api.request(
        "POST",
        path + "/viewers",
        "alice",
        json={
            "viewer_id": bob,
            "confirm": True,
        },
    )
    assert grant.status_code == 201, grant.text
    assert api.request("GET", path + "/viewers", "alice").json() == [{"viewer_id": bob}]
    assert api.request("GET", path + "/viewers", "bob").status_code == 404
    assert (
        api.request(
            "POST",
            path + "/viewers",
            "charlie",
            json={
                "viewer_id": bob,
                "confirm": True,
            },
        ).status_code
        == 404
    )
    published = api.request(
        "POST",
        path + "/publish",
        "alice",
        json={
            "expected_version": 0,
            "confirm": True,
            "reason": "Autorització específica",
            "audience": "selected",
        },
    )
    assert published.status_code == 200, published.text
    assert published.json()["audience"] == "selected"
    assert [n["id"] for n in api.request("GET", "/shared-needs", "bob").json()] == [nid]
    assert api.request("GET", f"/shared-needs/{nid}", "bob").status_code == 200
    assert api.request("GET", "/shared-needs", "charlie").json() == []
    assert api.request("GET", f"/shared-needs/{nid}", "charlie").status_code == 404
    assert api.request("GET", f"/idea-drafts/{bf.json()['id']}", "bob").status_code == 404
    assert api.request("GET", f"/idea-drafts/{bf.json()['id']}", "charlie").status_code == 404
    assert (
        api.request(
            "POST",
            path + "/viewers",
            "alice",
            json={
                "viewer_id": bob,
                "confirm": True,
            },
        ).status_code
        == 409
    )
    revoked = api.request(
        "POST",
        path + "/revoke",
        "alice",
        json={
            "expected_version": 1,
            "confirm": True,
            "reason": "Acabada",
        },
    )
    assert revoked.status_code == 200, revoked.text
    assert api.request("GET", "/shared-needs", "bob").json() == []
