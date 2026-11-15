"""BF Proof: only authorized A/B can attest a versioned private contribution."""

from sqlalchemy import text
from sqlalchemy.orm import Session

from campus_api.db import bind_actor
from tests.test_inc_agreements import TERMS, accepted_bf_contact


def confirmed_bf(api):
    request_id, draft_id, _, _, _, _ = accepted_bf_contact(api)
    agreement = api.request(
        "POST",
        "/agreements",
        "alice",
        json={"request_id": request_id, "terms": TERMS},
    )
    assert agreement.status_code == 201, agreement.text
    item = agreement.json()
    for actor in ("alice", "bob"):
        r = api.request(
            "POST",
            f"/agreements/{item['id']}/confirmations",
            actor,
            json={
                "expected_version": 1,
                "expected_hash": item["terms_sha256"],
                "confirm": True,
            },
        )
        assert r.status_code == 200, r.text
    return item["id"], draft_id


def test_no_proof_without_bilateral_agreement(api):
    request_id, _, _, _, _, _ = accepted_bf_contact(api)
    agreement = api.request(
        "POST",
        "/agreements",
        "alice",
        json={"request_id": request_id, "terms": TERMS},
    ).json()
    path = f"/agreements/{agreement['id']}/proofs"
    assert (
        api.request(
            "POST", path, "bob", json={"kind": "work", "summary": "Disseny de prova"}
        ).status_code
        == 409
    )
    assert (
        api.request(
            "POST", path, "charlie", json={"kind": "work", "summary": "Sense permís"}
        ).status_code
        == 404
    )


def test_bf_proof_attestation_evidence_revision_and_withdrawal(api):
    agreement_id, draft_id = confirmed_bf(api)
    path = f"/agreements/{agreement_id}/proofs"
    response = api.request(
        "POST",
        path,
        "bob",
        json={"kind": "work", "summary": "Mostra tèxtil BF executada"},
    )
    assert response.status_code == 201, response.text
    record = response.json()
    proof_id = record["id"]
    root = f"/proofs/{proof_id}"
    assert record["version"] == 1
    assert record["recognition"] == "declared"
    assert record["has_evidence"] is False
    assert "owner_id" not in record and "requester_id" not in record
    assert api.request("GET", root, "charlie").status_code == 404
    assert api.request("GET", root + "/evidence", "charlie").status_code == 404
    assert api.request("GET", root + "/attestations", "charlie").status_code == 404
    assert api.request("GET", "/proofs", "charlie").json() == []

    one = api.request(
        "POST",
        root + "/attestations",
        "alice",
        json={
            "expected_version": 1,
            "decision": "confirm",
            "note": "He vist la mostra aportada",
            "confirm": True,
        },
    )
    assert one.status_code == 200, one.text
    assert one.json()["recognition"] == "participant_attested"
    assert one.json()["confirmed_by_me"] is True
    assert one.json()["confirmed_by_counterpart"] is False
    two = api.request(
        "POST",
        root + "/attestations",
        "bob",
        json={
            "expected_version": 1,
            "decision": "confirm",
            "note": "Confirmo haver fet la mostra",
            "confirm": True,
        },
    )
    assert two.status_code == 200, two.text
    assert two.json()["recognition"] == "bilaterally_attested"
    assert (
        api.request(
            "POST",
            root + "/attestations",
            "bob",
            json={
                "expected_version": 1,
                "decision": "dispute",
                "note": "No puc substituir una atestació",
                "confirm": True,
            },
        ).status_code
        == 409
    )

    denied = api.request(
        "POST",
        root + "/evidence",
        "charlie",
        json={
            "expected_version": 1,
            "origin": "self",
            "source_reference": "BF-001",
            "source_version": "R1",
            "provenance": "Mesura declarada",
            "rights_note": "Privat",
        },
    )
    assert denied.status_code == 404
    assert (
        api.request(
            "POST",
            root + "/evidence",
            "alice",
            json={
                "expected_version": 1,
                "origin": "self",
                "source_reference": "BF-001",
                "source_version": "R1",
                "provenance": "Mesura declarada",
                "rights_note": "Privat",
            },
        ).status_code
        == 403
    )
    evidence = api.request(
        "POST",
        root + "/evidence",
        "bob",
        json={
            "expected_version": 1,
            "origin": "experiment",
            "source_reference": "BF-TEST-001",
            "source_version": "R1",
            "provenance": "Registre sintètic de prova tèxtil",
            "rights_note": "Només participants, sense reutilització pública",
        },
    )
    assert evidence.status_code == 201, evidence.text
    assert evidence.json()["audience"] == "private"
    assert evidence.json()["review_state"] == "declared"
    assert evidence.json()["proof_version"] == 2
    assert "owner_id" not in evidence.json()
    updated = api.request("GET", root, "bob").json()
    assert updated["version"] == 2
    assert updated["recognition"] == "declared"
    assert updated["confirmed_by_me"] is False
    assert updated["confirmed_by_counterpart"] is False
    assert updated["has_evidence"] is True
    assert (
        api.request(
            "POST",
            root + "/attestations",
            "alice",
            json={
                "expected_version": 1,
                "decision": "confirm",
                "note": "Confirmació antiga",
                "confirm": True,
            },
        ).status_code
        == 409
    )
    history = api.request("GET", root + "/evidence", "bob").json()
    assert len(history) == 1
    assert history[0]["source_reference"] == "BF-TEST-001"
    assert len(api.request("GET", root + "/attestations", "alice").json()) == 2

    disagreement = api.request(
        "POST",
        root + "/attestations",
        "alice",
        json={
            "expected_version": 2,
            "decision": "dispute",
            "note": "Aquest registre no verifica la qualitat",
            "confirm": True,
        },
    )
    assert disagreement.status_code == 200, disagreement.text
    assert disagreement.json()["recognition"] == "disputed"
    assert api.request("GET", f"/idea-drafts/{draft_id}", "bob").status_code == 404
    withdrawn = api.request(
        "POST",
        root + "/withdraw",
        "bob",
        json={
            "expected_version": 2,
            "reason": "La prova serà reformulada",
            "confirm": True,
        },
    )
    assert withdrawn.status_code == 200, withdrawn.text
    assert withdrawn.json()["recognition"] == "withdrawn"
    assert withdrawn.json()["version"] == 3
    assert (
        api.request(
            "POST",
            root + "/attestations",
            "alice",
            json={
                "expected_version": 3,
                "decision": "confirm",
                "note": "No",
                "confirm": True,
            },
        ).status_code
        == 409
    )


def test_inc_proof_rls_forced_on_three_tables(api):
    if api.app.state.engine.dialect.name != "postgresql":
        return
    with api.app.state.engine.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class "
                "WHERE relname IN "
                "('proof_contributions','proof_evidence','proof_attestations')"
            )
        ).all()
    assert len(rows) == 3
    assert all(enabled and forced for _, enabled, forced in rows)


def test_inc_proof_direct_sql_cannot_read_unrelated_claims(protected_api):
    api, limited, admin = protected_api
    role = limited.url.username
    with admin.begin() as conn:
        conn.execute(
            text(
                f"GRANT SELECT ON proof_contributions, proof_evidence, proof_attestations TO {role}"
            )
        )
    # Populate through the admin harness. The separate SQL reader below must
    # be under an unprivileged role to demonstrate that RLS rejects C.
    api.app.state.engine = admin
    try:
        agreement_id, _ = confirmed_bf(api)
        response = api.request(
            "POST",
            f"/agreements/{agreement_id}/proofs",
            "bob",
            json={"kind": "knowledge", "summary": "Coneixement aportat al BF pilot"},
        )
        assert response.status_code == 201, response.text
        charlie = api.request("GET", "/me", "charlie").json()["id"]
    finally:
        api.app.state.engine = limited
    with Session(limited) as db:
        bind_actor(db, charlie)
        assert db.execute(text("SELECT id FROM proof_contributions")).all() == []
        assert db.execute(text("SELECT id FROM proof_evidence")).all() == []
        assert db.execute(text("SELECT id FROM proof_attestations")).all() == []
