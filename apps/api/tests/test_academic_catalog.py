"""A public academic curriculum source never implies enrollment or VDI access."""


def test_academic_catalog_is_read_only_and_not_provisionable(api):
    response = api.request("GET", "/campus/module-templates", "alice")
    assert response.status_code == 200, response.text
    catalog = response.json()
    assert len(catalog) == 7
    assert all(item["institution"] == "UPC-FIB" for item in catalog)
    assert all(item["academic_year"] == "2026-2027" for item in catalog)
    assert all(item["source_status"] == "public_reference" for item in catalog)
    assert all(item["catalog_type"] == "academic_example" for item in catalog)
    assert all(item["is_provisionable"] is False for item in catalog)
    assert len({item["course_code"] for item in catalog}) == len(catalog)
    assert all("users" not in str(item).lower() for item in catalog)
    assert api.request(
        "GET", "/campus/module-templates?area=data", "bob"
    ).json() == [
        item for item in catalog if item["area"] == "data"
    ]
    assert api.request(
        "GET", "/campus/module-templates/270010", "charlie"
    ).json()["suggested_lab"] == "sql_sandbox"
    assert api.request(
        "GET", "/campus/module-templates/unknown", "alice"
    ).status_code == 404
    assert api.request(
        "POST", "/campus/module-templates", "alice",
        json={"course_code": "fake", "is_provisionable": True},
    ).status_code == 405
    assert api.client.get("/v1/campus/module-templates").status_code == 401


def test_academic_templates_do_not_grant_private_project_access(api):
    bf = api.request(
        "POST", "/idea-drafts", "alice",
        json={"question": "Validar BF al curs universitari", "name": "BF privat"},
    )
    assert bf.status_code == 201, bf.text
    assert api.request(
        "GET", "/campus/module-templates", "bob"
    ).status_code == 200
    assert api.request(
        "GET", f"/idea-drafts/{bf.json()['id']}", "bob"
    ).status_code == 404
