"""Inc Connect A/B/C: no automatic contact, project rights or disclosure."""

from sqlalchemy import text
from sqlalchemy.orm import Session

from campus_api.db import bind_actor


def published_bf(api):
    owner = api.request("GET", "/me", "alice").json()
    bob = api.request("GET", "/me", "bob").json()
    api.request("GET", "/me", "charlie")
    draft = api.request(
        "POST",
        "/idea-drafts",
        "alice",
        json={
            "question": "BF: podem produir una peça 1-of-1?",
            "name": "BF90 Pla comercial estrictament privat",
            "intention": "Pressupost i noms dels proveïdors privats",
        },
    )
    assert draft.status_code == 201, draft.text
    base = f"/idea-drafts/{draft.json()['id']}/shared-needs"
    need = api.request(
        "POST",
        base,
        "alice",
        json={
            "title": "Taller per una peça única",
            "description": "Busquem un taller de confecció per al prototip.",
        },
    )
    assert need.status_code == 201, need.text
    need_id = need.json()["id"]
    grant = api.request(
        "POST",
        f"{base}/{need_id}/viewers",
        "alice",
        json={"viewer_id": bob["id"], "confirm": True},
    )
    assert grant.status_code == 201, grant.text
    pub = api.request(
        "POST",
        f"{base}/{need_id}/publish",
        "alice",
        json={
            "expected_version": 0,
            "confirm": True,
            "audience": "selected",
            "reason": "Contacte autoritzat només per B",
        },
    )
    assert pub.status_code == 200, pub.text
    return owner, bob, draft.json()["id"], need_id


def test_bf_consent_contact_then_owner_accepts_without_project_grant(api):
    _, _, draft, need = published_bf(api)
    endpoint = f"/shared-needs/{need}/connect-requests"
    assert api.request("POST", endpoint, "charlie", json={"note": "Interès"}).status_code == 404
    assert api.request("POST", endpoint, "alice", json={"note": "Auto-contacte"}).status_code == 404
    response = api.request("POST", endpoint, "bob", json={"note": "Puc ajudar amb el prototip BF."})
    assert response.status_code == 201, response.text
    created = response.json()
    assert created["status"] == "pending"
    assert created["role"] == "requester"
    assert "owner_id" not in created and "requester_id" not in created
    assert "Pressupost" not in str(created)
    path = f"/connect-requests/{created['id']}"
    for actor in ("alice", "bob"):
        mine = api.request("GET", path, actor)
        assert mine.status_code == 200
        assert mine.json()["role"] == ("owner" if actor == "alice" else "requester")
        assert len(api.request("GET", "/connect-requests", actor).json()) == 1
    assert api.request("GET", path, "charlie").status_code == 404
    assert api.request("GET", path + "/events", "charlie").status_code == 404
    assert api.request("GET", "/connect-requests", "charlie").json() == []
    assert api.request("POST", endpoint, "bob", json={"note": "Duplicat"}).status_code == 409
    assert (
        api.request(
            "POST",
            path + "/transitions",
            "bob",
            json={"expected_version": 0, "decision": "accepted", "confirm": True},
        ).status_code
        == 404
    )
    accepted = api.request(
        "POST",
        path + "/transitions",
        "alice",
        json={"expected_version": 0, "decision": "accepted", "confirm": True},
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "accepted"
    assert accepted.json()["version"] == 1
    assert [event["action"] for event in api.request("GET", path + "/events", "bob").json()] == [
        "requested",
        "accepted",
    ]
    assert api.request("GET", f"/idea-drafts/{draft}", "bob").status_code == 404
    assert api.request("GET", f"/idea-drafts/{draft}", "charlie").status_code == 404
    assert (
        api.request(
            "POST",
            path + "/transitions",
            "alice",
            json={"expected_version": 0, "decision": "declined", "confirm": True},
        ).status_code
        == 409
    )


def test_bf_contact_rejection_withdrawal_and_revoked_need(api):
    _, _, draft, need = published_bf(api)
    endpoint = f"/shared-needs/{need}/connect-requests"
    response = api.request("POST", endpoint, "bob", json={"note": "Proposta breu"})
    assert response.status_code == 201
    path = f"/connect-requests/{response.json()['id']}"
    withdrawn = api.request(
        "POST",
        path + "/transitions",
        "bob",
        json={"expected_version": 0, "decision": "withdrawn", "confirm": True},
    )
    assert withdrawn.status_code == 200
    assert withdrawn.json()["status"] == "withdrawn"
    assert (
        api.request(
            "POST",
            path + "/transitions",
            "alice",
            json={"expected_version": 1, "decision": "accepted", "confirm": True},
        ).status_code
        == 409
    )
    revoke = api.request(
        "POST",
        f"/idea-drafts/{draft}/shared-needs/{need}/revoke",
        "alice",
        json={"expected_version": 1, "confirm": True, "reason": "Prova tancada"},
    )
    assert revoke.status_code == 200, revoke.text
    assert api.request("POST", endpoint, "charlie", json={"note": "Dubtós"}).status_code == 404
    assert api.request("POST", endpoint, "bob", json={"note": "De nou"}).status_code == 404
    assert api.request("GET", path, "bob").status_code == 200


def test_bf_deny_owner_acceptance_after_need_revocation(api):
    _, _, draft, need = published_bf(api)
    request = api.request(
        "POST",
        f"/shared-needs/{need}/connect-requests",
        "bob",
        json={"note": "Interès explícit"},
    )
    assert request.status_code == 201
    revoke = api.request(
        "POST",
        f"/idea-drafts/{draft}/shared-needs/{need}/revoke",
        "alice",
        json={"expected_version": 1, "confirm": True, "reason": "Retirada"},
    )
    assert revoke.status_code == 200
    assert (
        api.request(
            "POST",
            f"/connect-requests/{request.json()['id']}/transitions",
            "alice",
            json={"expected_version": 0, "decision": "accepted", "confirm": True},
        ).status_code
        == 409
    )


def test_connections_have_forced_rls(api):
    if api.app.state.engine.dialect.name != "postgresql":
        return
    with api.app.state.engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class "
                "WHERE relname IN ('connect_requests', 'connect_events')"
            )
        ).all()
    assert len(rows) == 2
    assert all(enabled and forced for _, enabled, forced in rows)


def test_cross_user_direct_sql_rls(protected_api):
    api, limited, admin = protected_api
    role = limited.url.username
    with admin.begin() as conn:
        conn.execute(
            text(
                f"GRANT SELECT ON connect_requests, connect_events, "
                f"shareable_needs, need_viewer_grants TO {role}"
            )
        )
    # The RLS test role can read only its own request, even with SQL grants.
    with Session(limited) as db:
        actor = api.request("GET", "/me", "bob").json()["id"]
        bind_actor(db, actor)
        assert db.execute(text("SELECT id FROM connect_requests")).all() == []
        assert db.execute(text("SELECT id FROM connect_events")).all() == []
