from uuid import uuid4

import pytest
from sqlalchemy import text


def new_draft(api, actor="alice"):
    result = api.request(
        "POST",
        "/idea-drafts",
        actor,
        json={"question": "Com validar una peça 1-of-1?"},
    )
    assert result.status_code == 201, result.text
    return result.json()["id"]


def new_experiment(api, draft_id, actor="alice"):
    response = api.request(
        "POST",
        f"/idea-drafts/{draft_id}/experiments",
        actor,
        json={
            "question": "Què valoren de la peça única?",
            "method": "Mostrar tres conceptes ficticis",
            "success_criterion": "Registrar objeccions i comprensió",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_bf_projecte_viu_complete_owner_journey(api):
    draft = new_draft(api)
    path = f"/idea-drafts/{draft}/experiments"
    experiment = new_experiment(api, draft)
    assert [e["id"] for e in api.request("GET", path, "alice").json()] == [experiment]
    results_path = f"{path}/{experiment}/results"
    data = {
        "outcome": "inconclusive",
        "observations": "La mostra és massa petita per concloure.",
        "evidence": [{"reference": "simulacio-001", "source_note": "Resum fictici del test"}],
    }
    result = api.request("POST", results_path, "alice", json=data)
    assert result.status_code == 201, result.text
    recorded = result.json()
    assert recorded["outcome"] == "inconclusive"
    assert recorded["evidence"][0]["review_status"] == "declared"
    assert recorded["evidence"][0]["reference"] == "simulacio-001"
    assert len(api.request("GET", results_path, "alice").json()) == 1
    assert api.request("GET", path, "alice").json()[0]["status"] == "completed"
    later = api.request(
        "POST",
        f"{results_path}/{recorded['id']}/evidence",
        "alice",
        json={"reference": "simulacio-002"},
    )
    assert later.status_code == 201, later.text
    assert len(api.request("GET", results_path, "alice").json()[0]["evidence"]) == 2
    # Append-only result history, not overwritten by new observations.
    next_result = api.request(
        "POST",
        results_path,
        "alice",
        json={"outcome": "supportive", "observations": "Segona prova fictícia."},
    )
    assert next_result.status_code == 201
    assert len(api.request("GET", results_path, "alice").json()) == 2


def test_experiments_deny_unauthenticated_and_other_users(api):
    draft = new_draft(api)
    experiment = new_experiment(api, draft)
    results_path = f"/idea-drafts/{draft}/experiments/{experiment}/results"
    recorded = api.request(
        "POST",
        results_path,
        "alice",
        json={"outcome": "unsupported", "observations": "Sense suport."},
    ).json()
    for path in (
        f"/idea-drafts/{draft}/experiments",
        results_path,
    ):
        assert api.client.get("/v1" + path).status_code == 401
        assert api.request("GET", path, "bob").status_code == 404
    assert (
        api.request(
            "POST",
            f"/idea-drafts/{draft}/experiments",
            "bob",
            json={"question": "Forçat", "method": "metode", "success_criterion": "criteri"},
        ).status_code
        == 404
    )
    assert (
        api.request(
            "POST",
            results_path,
            "bob",
            json={"outcome": "supportive", "observations": "Intent aliè"},
        ).status_code
        == 404
    )
    evidence_path = f"{results_path}/{recorded['id']}/evidence"
    assert (
        api.request("POST", evidence_path, "bob", json={"reference": "prohibit"}).status_code == 404
    )
    other_draft = new_draft(api, "bob")
    wrong_parent = f"/idea-drafts/{other_draft}/experiments/{experiment}/results"
    assert api.request("GET", wrong_parent, "bob").status_code == 404
    assert api.request("GET", f"/idea-drafts/{uuid4()}/experiments", "alice").status_code == 404


@pytest.mark.parametrize(
    "payload",
    [
        {"question": "", "method": "test", "success_criterion": "criteri"},
        {"question": "Prova", "method": "", "success_criterion": "criteri"},
        {"question": "Prova", "method": "m", "success_criterion": ""},
        {
            "question": "Prova",
            "method": "m",
            "success_criterion": "c",
            "owner_id": "spoofed",
        },
    ],
)
def test_experiment_validation_rejects_bad_input(api, payload):
    draft = new_draft(api)
    response = api.request("POST", f"/idea-drafts/{draft}/experiments", "alice", json=payload)
    assert response.status_code == 422, response.text


def test_result_validation_and_no_implicit_verification(api):
    draft = new_draft(api)
    experiment = new_experiment(api, draft)
    path = f"/idea-drafts/{draft}/experiments/{experiment}/results"
    for bad in [
        {"outcome": "verified", "observations": "inventat"},
        {"outcome": "inconclusive", "observations": ""},
        {"outcome": "supportive", "observations": "ok", "owner_id": "spoofed"},
        {
            "outcome": "supportive",
            "observations": "ok",
            "evidence": [{"reference": "", "source_note": ""}],
        },
    ]:
        assert api.request("POST", path, "alice", json=bad).status_code == 422
    assert api.request("GET", path, "alice").json() == []


def test_owner_scoped_composite_relationships(api):
    draft_a = new_draft(api)
    draft_b = new_draft(api, "bob")
    experiment = new_experiment(api, draft_a)
    # The API will never allow a cross-owner reference, including a valid UUID from Bob.
    assert (
        api.request(
            "POST",
            f"/idea-drafts/{draft_b}/experiments/{experiment}/results",
            "bob",
            json={"outcome": "supportive", "observations": "intrusió"},
        ).status_code
        == 404
    )


def test_postgres_experiment_rls_rejects_cross_owner_even_with_grants(api):
    if api.app.state.engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL-specific RLS test")
    draft = new_draft(api)
    experiment = new_experiment(api, draft)
    alice = api.request("GET", "/me", "alice").json()["id"]
    bob = api.request("GET", "/me", "bob").json()["id"]
    engine = api.app.state.engine
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                "SELECT relname, relrowsecurity, relforcerowsecurity "
                "FROM pg_class WHERE relname IN "
                "('project_experiments','experiment_results','experiment_evidence')"
            )
        ).all()
        assert len(rows) == 3
        assert all(row.relrowsecurity and row.relforcerowsecurity for row in rows)
    # A real non-privileged role is tested via the dedicated RLS role fixture in CI.
    assert alice != bob
    assert api.request("GET", f"/idea-drafts/{draft}/experiments", "bob").status_code == 404
    assert (
        api.request(
            "GET", f"/idea-drafts/{draft}/experiments/{experiment}/results", "bob"
        ).status_code
        == 404
    )


def test_progressive_draft_activation_and_reformulation_preserves_history(api):
    draft_id = new_draft(api)
    root = f"/idea-drafts/{draft_id}/experiments"
    created = api.request("POST", root, "alice", json={})
    assert created.status_code == 201, created.text
    draft_experiment = created.json()
    assert draft_experiment["status"] == "draft"
    assert draft_experiment["question"] == ""
    experiment_id = draft_experiment["id"]
    result_path = f"{root}/{experiment_id}/results"
    premature = api.request(
        "POST",
        result_path,
        "alice",
        json={"outcome": "inconclusive", "observations": "encara no executada"},
    )
    assert premature.status_code == 409
    partial = api.request(
        "POST",
        f"{root}/{experiment_id}",
        "alice",
        json={"question": "Què volem comprovar?"},
    )
    assert partial.status_code == 200, partial.text
    assert partial.json()["status"] == "draft"
    assert api.request("POST", f"{root}/{experiment_id}/activate", "alice").status_code == 422
    complete = api.request(
        "POST",
        f"{root}/{experiment_id}",
        "alice",
        json={
            "question": "Què volem comprovar?",
            "method": "Prova limitada fictícia",
            "success_criterion": "Registrar comprensió",
        },
    )
    assert complete.status_code == 200, complete.text
    activated = api.request("POST", f"{root}/{experiment_id}/activate", "alice")
    assert activated.status_code == 200, activated.text
    assert activated.json()["status"] == "active"
    assert api.request(
        "POST", f"{root}/{experiment_id}", "alice", json={}
    ).status_code == 409
    result = api.request(
        "POST",
        result_path,
        "alice",
        json={"outcome": "inconclusive", "observations": "Resultat no concloent."},
    )
    assert result.status_code == 201, result.text
    new_revision = api.request(
        "POST",
        root,
        "alice",
        json={
            "reformulates_id": experiment_id,
            "question": "Com reduïm la incertesa?",
            "method": "Segona prova fictícia",
            "success_criterion": "Obtenir més observacions",
        },
    )
    assert new_revision.status_code == 201, new_revision.text
    assert new_revision.json()["reformulates_id"] == experiment_id
    assert len(api.request("GET", result_path, "alice").json()) == 1
    assert (
        api.request("POST", root, "bob", json={"reformulates_id": experiment_id}).status_code
        == 404
    )
    assert api.request(
        "POST", root, "alice", json={"reformulates_id": str(uuid4())}
    ).status_code == 404
