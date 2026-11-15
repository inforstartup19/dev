#!/usr/bin/env python3
"""Read-only Azure PostgreSQL resource inventory for IncForStartUp dev.

Requires Azure CLI with existing OIDC login. Makes GET/list requests only:
'az account show', 'az group show', and 'az resource list'.
Never connects to databases, obtains keys, or executes migrations.
"""
from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys

RESOURCE_TYPES = (
    "Microsoft.DBforPostgreSQL/flexibleServers",
    "Microsoft.DBforPostgreSQL/servers",
    "Microsoft.DBforPostgreSQL/serverGroupsv2",
)
EXPECTED_RG = "rg-incforstartup-dev"


def az_json(*args):
    result = subprocess.run(
        ["az", *args, "--output", "json", "--only-show-errors"],
        capture_output=True,
        text=True,
        timeout=90,
        check=False,
    )
    if result.returncode:
        # Do not forward stderr: CLI diagnostics can contain tenant/account details.
        raise RuntimeError("Azure read-only inventory failed (permissions or connectivity)")
    return json.loads(result.stdout)


def main():
    report = {
        "audit": "incforstartup-dev-postgres-inventory",
        "mode": "read-only",
        "database_connection_attempted": False,
        "alembic_version_checked": False,
        "target_resource_group": EXPECTED_RG,
        "resource_group_accessible": False,
        "subscription_postgres_counts": {},
        "target_rg_postgres_counts": {},
        "decision": "NO_GO",
        "reason": "Not executed",
    }
    report_path = pathlib.Path(os.environ.get("AUDIT_REPORT", "dev-postgres-inventory.json"))
    try:
        account = az_json("account", "show")
        if not account.get("id"):
            raise RuntimeError("No Azure subscription is selected")
        report["subscription_selected"] = True
        try:
            rg = az_json("group", "show", "--name", EXPECTED_RG)
            report["resource_group_accessible"] = rg.get("name", "").lower() == EXPECTED_RG
        except RuntimeError:
            report["resource_group_accessible"] = False
        for typ in RESOURCE_TYPES:
            # The current Azure identity determines the scope actually visible.
            resources = az_json("resource", "list", "--resource-type", typ)
            report["subscription_postgres_counts"][typ] = len(resources)
            report["target_rg_postgres_counts"][typ] = sum(
                r.get("resourceGroup", "").lower() == EXPECTED_RG for r in resources
            )
        count = sum(report["target_rg_postgres_counts"].values())
        if count:
            report["decision"] = "REQUIRES_PRIVATE_DB_AUDIT"
            report["reason"] = (
                "PostgreSQL resources were listed in target RG. "
                "Obtain approved private-network read-only DB access to inspect Alembic."
            )
        else:
            report["decision"] = "NO_GO"
            report["reason"] = (
                "No PostgreSQL resource was visible in target RG. "
                "Verify whether DB lives in another RG/subscription or is not deployed."
            )
    except (RuntimeError, ValueError, subprocess.TimeoutExpired, OSError) as exc:
        report["decision"] = "NO_GO"
        report["reason"] = "Inventory unavailable: " + type(exc).__name__
    finally:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False, indent=2))
    # An inventory-only task succeeds even when no database is present.
    return 0 if report.get("subscription_selected") else 1


if __name__ == "__main__":
    sys.exit(main())
