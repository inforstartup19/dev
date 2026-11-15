"""BF agreements: two distinct actors, exact hashes and version-gated signatures."""

from sqlalchemy import text


def accepted_bf_contact(api):
    alice = api.request("GET", "/me", "alice").json()["id"]
    bob = api.request("GET", "/me", "bob").json()["id"]
    api.request("GET", "/me", "charlie")
    draft = api.request(
        "POST",
        "/idea-drafts",
        "alice",
        json={
            "question": "Com validem BF90?",
            "name": "BF — confidencial",
            "intention": "Preus interns secrets",
        },
    )
    assert draft.status_code == 201, draft.text
    base = f"/idea-drafts/{draft.json()['id']}/shared-needs"
    need = api.request(
        "POST",
        base,
        "alice",
        json={
            "title": "Fabricar una peça única",
            "description": "Busquem taller extern",
        },
    )
    assert need.status_code == 201, need.text
    nid = need.json()["id"]
    assert (
        api.request(
            "POST",
            f"{base}/{nid}/viewers",
            "alice",
            json={"viewer_id": bob, "confirm": True},
        ).status_code
        == 201
    )
    published = api.request(
        "POST",
        f"{base}/{nid}/publish",
        "alice",
        json={
            "expected_version": 0,
            "confirm": True,
            "reason": "Necessitat puntual",
            "audience": "selected",
        },
    )
    assert published.status_code == 200, published.text
    contact = api.request(
        "POST",
        f"/shared-needs/{nid}/connect-requests",
        "bob",
        json={"note": "M'hi ofereixo voluntàriament"},
    )
    assert contact.status_code == 201, contact.text
    reqid = contact.json()["id"]
    accepted = api.request(
        "POST",
        f"/connect-requests/{reqid}/transitions",
        "alice",
        json={"expected_version": 0, "decision": "accepted", "confirm": True},
    )
    assert accepted.status_code == 200, accepted.text
    return reqid, draft.json()["id"], base, nid, alice, bob


TERMS = {
    "goal": "Validar un prototip 1-of-1",
    "contribution": "Realització d'una mostra",
    "commitment": "2 jornades estimades",
    "deliverable": "Mostra i informe de resultat",
    "conditions": "Sense cessió d'IP automàtica",
    "access_scope": "Cap accés automàtic al projecte ni als arxius",
}


def test_two_independent_confirmations_are_needed(api):
    request_id, draft, _, _, _, _ = accepted_bf_contact(api)
    created = api.request(
        "POST",
        "/agreements",
        "alice",
        json={"request_id": request_id, "terms": TERMS},
    )
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["version"] == 1
    assert not item["fully_confirmed"]
    assert not item["owner_confirmed"]
    assert not item["requester_confirmed"]
    agreement = f"/agreements/{item['id']}"
    assert api.request("GET", agreement, "charlie").status_code == 404
    assert api.request("GET", "/agreements", "charlie").json() == []
    assert api.request("GET", agreement + "/revisions", "charlie").status_code == 404
    assert api.request("GET", f"/idea-drafts/{draft}", "bob").status_code == 404
    assert (
        api.request(
            "POST",
            "/agreements",
            "charlie",
            json={
                "request_id": request_id,
                "terms": TERMS,
            },
        ).status_code
        == 404
    )
    assert (
        api.request(
            "POST",
            "/agreements",
            "bob",
            json={
                "request_id": request_id,
                "terms": TERMS,
            },
        ).status_code
        == 409
    )

    wrong_hash = api.request(
        "POST",
        agreement + "/confirmations",
        "bob",
        json={"expected_version": 1, "confirm": True, "expected_hash": "0" * 64},
    )
    assert wrong_hash.status_code == 409
    ok = api.request(
        "POST",
        agreement + "/confirmations",
        "bob",
        json={"expected_version": 1, "confirm": True, "expected_hash": item["terms_sha256"]},
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["requester_confirmed"]
    assert not ok.json()["fully_confirmed"]
    # Duplicate confirmation is idempotent for the same actor and content.
    second = api.request(
        "POST",
        agreement + "/confirmations",
        "bob",
        json={"expected_version": 1, "confirm": True, "expected_hash": item["terms_sha256"]},
    )
    assert second.status_code == 200
    assert not second.json()["fully_confirmed"]
    both = api.request(
        "POST",
        agreement + "/confirmations",
        "alice",
        json={"expected_version": 1, "confirm": True, "expected_hash": item["terms_sha256"]},
    )
    assert both.status_code == 200
    assert both.json()["fully_confirmed"]
    assert both.json()["owner_confirmed"]


def test_edit_invalidates_previous_version_confirmations(api):
    request_id, _, _, _, _, _ = accepted_bf_contact(api)
    new = api.request(
        "POST",
        "/agreements",
        "alice",
        json={"request_id": request_id, "terms": TERMS},
    ).json()
    base = f"/agreements/{new['id']}"
    for actor in ("alice", "bob"):
        ack = api.request(
            "POST",
            base + "/confirmations",
            actor,
            json={"expected_version": 1, "confirm": True, "expected_hash": new["terms_sha256"]},
        )
        assert ack.status_code == 200
    updated_terms = {**TERMS, "commitment": "3 jornades estimades"}
    changed = api.request(
        "POST",
        base + "/revisions",
        "bob",
        json={"expected_version": 1, "terms": updated_terms},
    )
    assert changed.status_code == 200, changed.text
    item = changed.json()
    assert item["version"] == 2
    assert item["terms_sha256"] != new["terms_sha256"]
    assert not item["owner_confirmed"] and not item["requester_confirmed"]
    assert not item["fully_confirmed"]
    assert (
        api.request(
            "POST",
            base + "/revisions",
            "alice",
            json={"expected_version": 1, "terms": TERMS},
        ).status_code
        == 409
    )
    assert (
        api.request(
            "POST",
            base + "/confirmations",
            "alice",
            json={"expected_version": 1, "confirm": True, "expected_hash": new["terms_sha256"]},
        ).status_code
        == 409
    )
    history = api.request("GET", base + "/revisions", "alice").json()
    assert [h["version"] for h in history] == [1, 2]
    assert history[0]["terms"]["commitment"] == "2 jornades estimades"
    assert history[1]["terms"]["commitment"] == "3 jornades estimades"
    for actor in ("alice", "bob"):
        ok = api.request(
            "POST",
            base + "/confirmations",
            actor,
            json={"expected_version": 2, "confirm": True, "expected_hash": item["terms_sha256"]},
        )
        assert ok.status_code == 200, ok.text
    assert api.request("GET", base, "alice").json()["fully_confirmed"]


def test_one_party_can_cancel_but_cannot_grant_access(api):
    request_id, draft, _, _, _, _ = accepted_bf_contact(api)
    item = api.request(
        "POST",
        "/agreements",
        "alice",
        json={"request_id": request_id, "terms": TERMS},
    ).json()
    path = f"/agreements/{item['id']}"
    assert (
        api.request(
            "POST",
            path + "/cancel",
            "charlie",
            json={"expected_version": 1, "confirm": True, "reason": "No hi tinc rol"},
        ).status_code
        == 404
    )
    cancelled = api.request(
        "POST",
        path + "/cancel",
        "bob",
        json={"expected_version": 1, "confirm": True, "reason": "Canvi de disponibilitat"},
    )
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"
    assert not cancelled.json()["fully_confirmed"]
    assert (
        api.request(
            "POST",
            path + "/revisions",
            "alice",
            json={"expected_version": 1, "terms": TERMS},
        ).status_code
        == 409
    )
    assert (
        api.request(
            "POST",
            path + "/confirmations",
            "alice",
            json={"expected_version": 1, "confirm": True, "expected_hash": item["terms_sha256"]},
        ).status_code
        == 409
    )
    assert api.request("GET", f"/idea-drafts/{draft}", "bob").status_code == 404


def test_rbac_tables_have_forced_rls(api):
    if api.app.state.engine.dialect.name != "postgresql":
        return
    with api.app.state.engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class "
                "WHERE relname IN "
                "('collaboration_agreements','agreement_revisions','agreement_confirmations')"
            )
        ).all()
    assert len(rows) == 3
    assert all(enabled and forced for _, enabled, forced in rows)


def test_expired_agreement_cannot_be_revised_or_confirmed(api):
    from datetime import UTC, datetime, timedelta

    request_id, _, _, _, _, _ = accepted_bf_contact(api)
    response = api.request(
        "POST", "/agreements", "alice",
        json={"request_id": request_id, "terms": TERMS},
    )
    assert response.status_code == 201, response.text
    item = response.json()
    aid = item["id"]
    with api.app.state.engine.begin() as conn:
        conn.execute(
            text("UPDATE collaboration_agreements SET created_at = :old WHERE id = :id"),
            {"old": datetime.now(UTC) - timedelta(days=31), "id": aid},
        )
    detail = api.request("GET", f"/agreements/{aid}", "bob")
    assert detail.status_code == 200
    assert detail.json()["acceptance_expired"] is True
    confirmation = api.request(
        "POST", f"/agreements/{aid}/confirmations", "bob",
        json={
            "expected_version": 1, "expected_hash": item["terms_sha256"],
            "confirm": True,
        },
    )
    assert confirmation.status_code == 410
    revision = api.request(
        "POST", f"/agreements/{aid}/revisions", "alice",
        json={"expected_version": 1, "terms": TERMS},
    )
    assert revision.status_code == 410
    cancelled = api.request(
        "POST", f"/agreements/{aid}/cancel", "alice",
        json={"expected_version": 1, "confirm": True, "reason": "Negociació caducada"},
    )
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"
