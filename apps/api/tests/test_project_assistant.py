"""Contract tests for owner-scoped explainable guidance and lifecycle."""


def make_draft(api, actor="alice"):
    response = api.request(
        "POST",
        "/idea-drafts",
        actor,
        json={"question": "Com validar una peça BF?", "name": "BF — Be First"},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def get_guidance(api, project, actor="alice"):
    return api.request("GET", f"/idea-drafts/{project}/assistant/guidance", actor)


def test_guidance_private_and_read_only(api):
    project = make_draft(api)
    root = f"/idea-drafts/{project}"
    initial = get_guidance(api, project)
    assert initial.status_code == 200
    assert initial.json()["lifecycle"] == "active"
    assert initial.json()["advisory_only"] is True
    assert api.client.get("/v1" + root + "/assistant/guidance").status_code == 401
    assert get_guidance(api, project, "bob").status_code == 404

    exp = api.request(
        "POST",
        root + "/experiments",
        "alice",
        json={
            "question": "Validar una mostra",
            "method": "Pilot sintètic",
            "success_criterion": "Recollir respostes",
        },
    )
    assert exp.status_code == 201
    exp_id = exp.json()["id"]
    prompt = get_guidance(api, project).json()
    codes = [p["code"] for p in prompt["suggestions"]]
    assert "review-active-experiment" in codes
    assert "resource-planning" in codes
    assert all(p["optional"] for p in prompt["suggestions"])
    assert exp_id in prompt["suggestions"][0]["evidence_ids"]
    assert api.request("GET", root, "alice").json()["visibility"] == "private"
    assert api.request("GET", root + "/resource-intents", "alice").json() == []


def test_historical_choices_do_not_change_operational_lifecycle(api):
    project = make_draft(api)
    root = f"/idea-drafts/{project}"
    experiment = api.request(
        "POST",
        root + "/experiments",
        "alice",
        json={
            "question": "Prova BF",
            "method": "Enquesta",
            "success_criterion": "Validar objeccions",
        },
    ).json()
    for choice in ("pause", "close", "continue"):
        decision = api.request(
            "POST",
            root + "/decisions",
            "alice",
            json={"choice": choice, "rationale": "Revisió humana documentada."},
        )
        assert decision.status_code == 201
        report = get_guidance(api, project).json()
        assert report["lifecycle"] == "active"
        assert report["latest_decision_id"] == decision.json()["id"]
        assert api.request("GET", root, "alice").json()["visibility"] == "private"
        assert api.request("GET", root + "/experiments", "alice").json()[0]["status"] == "active"
    assert len(api.request("GET", root + "/decisions", "alice").json()) == 3
    assert experiment["id"]


def test_assistant_recommends_help_from_owned_decision_only(api):
    alice = make_draft(api)
    bob = make_draft(api, "bob")
    own_root = f"/idea-drafts/{alice}"
    response = api.request(
        "POST",
        own_root + "/decisions",
        "alice",
        json={"choice": "request_help", "rationale": "Cal suport."},
    )
    assert response.status_code == 201
    suggestion = get_guidance(api, alice).json()["suggestions"][0]
    assert suggestion["code"] == "person-after-help"
    assert suggestion["action"] == "prepare_person"
    assert suggestion["evidence_ids"] == [response.json()["id"]]
    assert get_guidance(api, bob, "bob").json()["suggestions"] == []
    assert get_guidance(api, alice, "bob").status_code == 404
    intent = api.request(
        "POST",
        own_root + "/resource-intents",
        "alice",
        json={"kind": "person", "description": "Especialista en prototips"},
    )
    assert intent.status_code == 201
    assert "person-after-help" not in [
        item["code"] for item in get_guidance(api, alice).json()["suggestions"]
    ]


def test_optional_feedback_requires_consent_and_is_private(api):
    alice = make_draft(api)
    bob = make_draft(api, "bob")
    root = f"/idea-drafts/{alice}/assistant/feedback"
    payload = {"code": "resource-planning", "choice": "dismiss", "consent": False}
    assert api.request("POST", root, "alice", json=payload).status_code == 422
    assert api.request("GET", root, "alice").json() == []
    payload["consent"] = True
    response = api.request("POST", root, "alice", json=payload)
    assert response.status_code == 201, response.text
    assert api.request("GET", root, "alice").json()[0]["choice"] == "dismiss"
    payload["choice"] = "restore"
    restored = api.request("POST", root, "alice", json=payload)
    assert restored.status_code == 201
    assert api.request("GET", root, "alice").json()[0]["choice"] == "restore"
    assert api.request("GET", root, "bob").status_code == 404
    assert api.request("POST", root, "bob", json=payload).status_code == 404
    assert api.request("GET", f"/idea-drafts/{bob}/assistant/feedback", "bob").json() == []
    assert api.client.get("/v1" + root).status_code == 401
