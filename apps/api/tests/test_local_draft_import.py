def test_local_copy_is_idempotent_private_and_owner_scoped(api):
    payload = {"source_id": "local-1", "question": "Una idea", "name": "Pilot"}
    first = api.request("POST", "/idea-drafts/local-import", "alice", json=payload)
    assert first.status_code == 200, first.text
    item = first.json()
    assert item["visibility"] == "private"
    assert (
        api.request("POST", "/idea-drafts/local-import", "alice", json=payload).json()["id"]
        == item["id"]
    )
    assert len(api.request("GET", "/idea-drafts", "alice").json()) == 1
    assert api.request("GET", f"/idea-drafts/{item['id']}", "bob").status_code == 404
    other = api.request("POST", "/idea-drafts/local-import", "bob", json=payload)
    assert other.status_code == 200 and other.json()["id"] != item["id"]


def test_local_copy_never_overwrites_changed_account_or_local_content(api):
    payload = {"source_id": "local-1", "question": "Una idea"}
    item = api.request("POST", "/idea-drafts/local-import", "alice", json=payload).json()
    for changed in [{**payload, "question": "Una altra idea"}, {**payload, "name": "Modificat"}]:
        assert (
            api.request("POST", "/idea-drafts/local-import", "alice", json=changed).status_code
            == 409
        )
    assert (
        api.request("GET", f"/idea-drafts/{item['id']}", "alice").json()["question"] == "Una idea"
    )
    api.request(
        "POST", f"/idea-drafts/{item['id']}", "alice", json={"question": "Editada al compte"}
    )
    assert (
        api.request("POST", "/idea-drafts/local-import", "alice", json=payload).status_code == 409
    )
    assert len(api.request("GET", "/idea-drafts", "alice").json()) == 1


def test_local_copy_rejects_unauthenticated_and_overposted_histories(api):
    assert api.client.post("/v1/idea-drafts/local-import", json={}).status_code == 401
    for extra in [
        {"owner_id": "bob"},
        {"visibility": "public"},
        {"history": []},
        {"source_id": ""},
    ]:
        payload = {"source_id": "local-1", "question": "Idea", **extra}
        assert (
            api.request("POST", "/idea-drafts/local-import", "alice", json=payload).status_code
            == 422
        )
    assert api.request("GET", "/idea-drafts", "alice").json() == []
