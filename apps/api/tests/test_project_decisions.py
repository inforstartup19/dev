from uuid import uuid4

import pytest


def draft(api, actor="alice"):
    response = api.request(
        "POST",
        "/idea-drafts",
        actor,
        json={"question": "Com validar BF 1-of-1?", "name": "BF — Be First"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_bf_decisions_optional_resources_are_private_and_append_only(api):
    owner = draft(api)
    root = f"/idea-drafts/{owner['id']}"
    experiment = api.request(
        "POST",
        root + "/experiments",
        "alice",
        json={
            "question": "Interessa una peça única?",
            "method": "Enquesta privada sintètica",
            "success_criterion": "Registrar objeccions",
        },
    )
    assert experiment.status_code == 201, experiment.text
    test_id = experiment.json()["id"]
    result = api.request(
        "POST",
        root + f"/experiments/{test_id}/results",
        "alice",
        json={
            "outcome": "inconclusive",
            "observations": "Una mostra massa petita.",
            "evidence": [{"reference": "BF-TEST-001", "source_note": "Evidència sintètica"}],
        },
    )
    assert result.status_code == 201, result.text
    decision = api.request(
        "POST",
        root + "/decisions",
        "alice",
        json={
            "experiment_id": test_id,
            "choice": "reformulate",
            "rationale": "Cal ampliar la mostra abans de continuar.",
        },
    )
    assert decision.status_code == 201, decision.text
    assert decision.json()["experiment_id"] == test_id
    assert api.request("GET", root + "/decisions", "alice").json()[0]["choice"] == "reformulate"
    intent = api.request(
        "POST",
        root + "/resource-intents",
        "alice",
        json={
            "kind": "person",
            "description": "Confecció 1-of-1 per validar una mostra sintètica.",
        },
    )
    assert intent.status_code == 201, intent.text
    assert len(api.request("GET", root + "/resource-intents", "alice").json()) == 1
    assert api.request("GET", root, "alice").json()["visibility"] == "private"
    assert len(api.request("GET", root + f"/experiments/{test_id}/results", "alice").json()) == 1

    for path in (root + "/decisions", root + "/resource-intents"):
        assert api.client.get("/v1" + path).status_code == 401
        assert api.request("GET", path, "bob").status_code == 404
    assert (
        api.request(
            "POST",
            root + "/decisions",
            "bob",
            json={"choice": "close", "rationale": "Intent aliè"},
        ).status_code
        == 404
    )
    assert (
        api.request(
            "POST",
            root + "/resource-intents",
            "bob",
            json={"kind": "funding", "description": "Intent aliè"},
        ).status_code
        == 404
    )

    own_b = draft(api, "bob")
    wrong_experiment = api.request(
        "POST",
        f"/idea-drafts/{own_b['id']}/decisions",
        "bob",
        json={
            "experiment_id": test_id,
            "choice": "continue",
            "rationale": "Referència creuada no autoritzada",
        },
    )
    assert wrong_experiment.status_code == 404
    assert api.request("GET", root + "/decisions", "alice").json() == [decision.json()]


@pytest.mark.parametrize(
    "choice",
    ["continue", "reformulate", "request_help", "pause", "close"],
)
def test_all_human_choices_preserve_visibility(api, choice):
    own = draft(api)
    root = f"/idea-drafts/{own['id']}"
    response = api.request(
        "POST",
        root + "/decisions",
        "alice",
        json={"choice": choice, "rationale": "Decisió raonada per al pilot."},
    )
    assert response.status_code == 201, response.text
    assert api.request("GET", root, "alice").json()["visibility"] == "private"


def test_reject_invalid_choices_fields_and_unexecuted_experiment(api):
    own = draft(api)
    root = f"/idea-drafts/{own['id']}"
    exp = api.request("POST", root + "/experiments", "alice", json={}).json()
    assert (
        api.request(
            "POST",
            root + "/decisions",
            "alice",
            json={
                "experiment_id": exp["id"],
                "choice": "continue",
                "rationale": "No executat",
            },
        ).status_code
        == 409
    )
    for payload in (
        {"choice": "publish", "rationale": "No està permès"},
        {"choice": "close", "rationale": ""},
        {"choice": "close", "rationale": "No", "owner_id": str(uuid4())},
    ):
        assert api.request(
            "POST",
        root + "/decisions",
        "alice", json=payload
        ).status_code == 422
    for payload in (
        {"kind": "publish", "description": "No"},
        {"kind": "person", "description": ""},
        {"kind": "person", "description": "No", "owner_id": str(uuid4())},
    ):
        assert api.request(
            "POST",
        root + "/resource-intents",
        "alice", json=payload
        ).status_code == 422
    assert api.request("GET", root + "/decisions", "alice").json() == []
    assert api.request("GET", root + "/resource-intents", "alice").json() == []
