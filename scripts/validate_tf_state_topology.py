"""Static safety gate for future remote Terraform state ownership.

No Azure connection, state movement or Terraform initialization is performed.
"""

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "infra/terraform/state-topology.json"
REQUIRED = {"platform-dev", "campus-control-plane", "campus-labs"}


def validate(payload: dict) -> None:
    assert payload.get("planning_only") is True, "State topology must be planning-only"
    scopes = payload.get("scopes", [])
    assert len(scopes) == len(REQUIRED), "Three explicit scopes required"
    names = {row["name"] for row in scopes}
    assert names == REQUIRED, "Every infrastructure owner needs a distinct scope"
    keys = [row["state_key"] for row in scopes]
    assert len(set(keys)) == len(keys), "Terraform state keys must never collide"
    assert all(key.endswith("/terraform.tfstate") for key in keys)
    assert all(".." not in key and not key.startswith("/") for key in keys)
    assert all(row["environment"] == "dev" for row in scopes)
    assert all(row["deployment_authorized"] is False for row in scopes)
    current = next(row for row in scopes if row["name"] == "platform-dev")
    assert current["state_key"] == "dev/terraform.tfstate"
    assert current["owner"] == "platform"
    backend = PATH.parent / "environments/dev/backend.hcl.example"
    backend_keys = re.findall(r'^\s*key\s*=\s*"([^"]+)"\s*$', backend.read_text(), re.MULTILINE)
    assert backend_keys == [current["state_key"]], "DEV backend example and state ownership must agree"
    assert current["configured_in_code"] is True
    assert all(
        row["configured_in_code"] is False
        for row in scopes
        if row["name"] != "platform-dev"
    ), "Proposed Campus scopes must remain unconnected"


if __name__ == "__main__":
    validate(json.loads(PATH.read_text(encoding="utf-8")))
    print("Campus Terraform state topology: unique, unchanged, no deployments authorized.")
