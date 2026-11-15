"""BF pilot: operational transition, reversibility and owner isolation."""

from uuid import uuid4

import pytest


def create(api, actor="alice"):
    response = api.request(
        "POST",
        "/idea-drafts",
        actor,
        json={"question": "Validació BF 1-of-1", "name": "BF — Be First"},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def transition(api, project, action, version, actor="alice", **overrides):
    reviewed = ["experiments", "participants", "agreements"]
    if action in ("close", "reopen"):
        reviewed.append("retention")
    payload = {
        "idempotency_key": str(uuid4()),
        "expected_version": version,
        "action": action,
        "reason": "BF: revisió sintètica documentada.",
        "review_note": "Impacte revisat manualment; compromisos externs pendents.",
        "reviewed": reviewed,
        "resume_conditions": "Revisió del responsable i proves abans de reprendre.",
    }
    payload.update(overrides)
    return api.request(
        "POST",
        f"/idea-drafts/{project}/lifecycle/transitions",
        actor,
        json=payload,
    )


def test_bf_pause_freezes_new_work_preserves_history_and_resumes(api):
    project = create(api)
    root = f"/idea-drafts/{project}"
    active = api.request(
        "POST",
        root + "/experiments",
        "alice",
        json={
            "question": "Interessa el model BF?",
            "method": "Pilot",
            "success_criterion": "Registrar objeccions",
        },
    )
    assert active.status_code == 201, active.text
    experiment_id = active.json()["id"]
    decision = api.request(
        "POST",
        root + "/decisions",
        "alice",
        json={"choice": "pause", "rationale": "Possible pausa, no efectiva"},
    )
    assert decision.status_code == 201
    assert api.request("GET", root + "/lifecycle", "alice").json()["state"] == "active"

    paused = transition(api, project, "pause", 0)
    assert paused.status_code == 201, paused.text
    assert paused.json()["previous_state"] == "active"
    assert paused.json()["next_state"] == "paused"
    assert paused.json()["version"] == 1
    for method, path, data in (
        ("POST", root, {"question": "Canvi indegut"}),
        ("POST", root + "/experiments", {}),
        (
            "POST",
            root + f"/experiments/{experiment_id}/results",
            {"outcome": "supportive", "observations": "Intent bloquejat"},
        ),
        ("POST", root + "/resource-intents", {"kind": "funding", "description": "Desar nou"}),
    ):
        assert api.request(method, path, "alice", json=data).status_code == 409
    assert api.request("GET", root + "/experiments", "alice").status_code == 200
    assert api.request("GET", root + "/decisions", "alice").json()[0]["id"] == decision.json()["id"]
    assert api.request("GET", root, "alice").json()["visibility"] == "private"
    assert api.request("GET", root + "/assistant/guidance", "alice").json()["lifecycle"] == "paused"

    resumed = transition(api, project, "resume", 1)
    assert resumed.status_code == 201, resumed.text
    assert api.request("GET", root + "/lifecycle", "alice").json()["state"] == "active"
    result = api.request(
        "POST",
        root + f"/experiments/{experiment_id}/results",
        "alice",
        json={"outcome": "inconclusive", "observations": "Requereix nova mostra."},
    )
    assert result.status_code == 201, result.text
    assert len(api.request("GET", root + "/lifecycle/events", "alice").json()) == 2


def test_bf_close_is_readable_and_reopening_requires_explicit_action(api):
    project = create(api)
    root = f"/idea-drafts/{project}"
    close = transition(api, project, "close", 0)
    assert close.status_code == 201, close.text
    assert api.request("GET", root + "/lifecycle", "alice").json()["state"] == "closed"
    assert api.request("POST", root + "/experiments", "alice", json={}).status_code == 409
    assert transition(api, project, "resume", 1).status_code == 409
    reopened = transition(api, project, "reopen", 1)
    assert reopened.status_code == 201, reopened.text
    assert reopened.json()["next_state"] == "active"
    assert transition(api, project, "reopen", 2).status_code == 409
    assert api.request("GET", root, "alice").json()["visibility"] == "private"


def test_bf_lifecycle_idempotency_stale_version_and_mandatory_review(api):
    project = create(api)
    key = str(uuid4())
    first = transition(api, project, "pause", 0, idempotency_key=key)
    assert first.status_code == 201, first.text
    again = transition(api, project, "pause", 0, idempotency_key=key)
    assert again.status_code == 201
    assert again.json()["id"] == first.json()["id"]
    assert (
        transition(
            api, project, "pause", 0, idempotency_key=key, reason="Different request"
        ).status_code
        == 409
    )
    assert transition(api, project, "close", 0).status_code == 409
    assert (
        transition(
            api, project, "close", 1, reviewed=["experiments", "participants", "agreements"]
        ).status_code
        == 422
    )
    assert transition(api, project, "resume", 1, resume_conditions="").status_code == 422
    assert len(api.request("GET", f"/idea-drafts/{project}/lifecycle/events", "alice").json()) == 1


def test_bf_two_accounts_cannot_read_write_or_infer_lifecycle(api):
    alice = create(api)
    bob = create(api, "bob")
    root = f"/idea-drafts/{alice}"
    for path in (root + "/lifecycle", root + "/lifecycle/events"):
        assert api.client.get("/v1" + path).status_code == 401
        assert api.request("GET", path, "bob").status_code == 404
    assert transition(api, alice, "close", 0, "bob").status_code == 404
    assert transition(api, bob, "pause", 0, "bob").status_code == 201
    assert api.request("GET", root + "/lifecycle", "alice").json()["state"] == "active"


@pytest.mark.parametrize("action", ["pause", "close"])
def test_no_review_attestation_no_transition(api, action):
    project = create(api)
    response = transition(api, project, action, 0, review_note="")
    assert response.status_code == 422
    assert api.request("GET", f"/idea-drafts/{project}/lifecycle", "alice").json()["version"] == 0
