"""Lab proposals must never provision a VM without university approval."""


def test_lab_preflight_is_always_blocked_and_non_provisioning(api):
    for template in (
        "web_ide",
        "sql_sandbox",
        "jupyter",
        "linux_lab",
        "avd_windows",
        "gpu_lab",
    ):
        response = api.request(
            "POST",
            "/campus/labs/preflight",
            "alice",
            json={
                "academic_module_code": "270010",
                "template": template,
                "requested_hours": 4,
                "budget_ceiling_eur": 20,
                "confirm": True,
            },
        )
        assert response.status_code == 200, response.text
        result = response.json()
        assert result["status"] == "blocked"
        assert result["provisionable"] is False
        assert result["cloud_resources_created"] is False
        assert result["actual_cost_known"] is False
        assert result["requested_hours"] == 4
        assert result["budget_ceiling_eur"] == 20
        assert len(result["blockers"]) >= 5
        assert "owner_id" not in result
        assert "tenant_id" not in result


def test_lab_preflight_rejects_unsafe_fields_and_unverified_access(api):
    root = "/campus/labs/preflight"
    request = {
        "academic_module_code": "270010",
        "template": "avd_windows",
        "requested_hours": 9,
        "budget_ceiling_eur": 20,
        "confirm": True,
    }
    assert api.request("POST", root, "alice", json=request).status_code == 422
    request["requested_hours"] = 3
    request["confirm"] = False
    assert api.request("POST", root, "alice", json=request).status_code == 422
    request["confirm"] = True
    request["template"] = "admin_shell"
    assert api.request("POST", root, "alice", json=request).status_code == 422
    assert api.client.post("/v1" + root, json=request).status_code == 401
    assert api.request("GET", root, "alice").status_code == 405
