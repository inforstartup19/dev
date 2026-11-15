"""Deny-by-default campus lab broker preflight. Never calls cloud provisioning."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, StringConstraints

from campus_api.auth import require_private_context

router = APIRouter(
    prefix="/v1/campus/labs",
    tags=["campus lab planning"],
    dependencies=[Depends(require_private_context)],
)
Template = Literal[
    "web_ide", "sql_sandbox", "jupyter", "linux_lab", "avd_windows", "gpu_lab"
]


class LabPreflightIn(BaseModel):
    academic_module_code: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)
    ]
    template: Template
    requested_hours: int = Field(ge=1, le=8)
    budget_ceiling_eur: float = Field(ge=0, le=10000, allow_inf_nan=False)
    confirm: Literal[True]


class LabPreflightOut(BaseModel):
    policy_version: Literal["inc-campus-labs-v0"]
    status: Literal["blocked"]
    provisionable: Literal[False]
    cloud_resources_created: Literal[False]
    academic_module_code: str
    template: Template
    requested_hours: int
    budget_ceiling_eur: float
    actual_cost_known: Literal[False]
    blockers: list[str]


@router.post("/preflight", response_model=LabPreflightOut)
def evaluate_lab_preflight(payload: LabPreflightIn):
    """A user-supplied budget is not a quote or institutional authorization."""
    blockers = [
        "Campus Lab Broker is not deployed or authorized",
        "Institution/course enrollment and role have not been verified",
        "Tenant isolation, region and license approvals are pending",
        "Live cloud pricing, quota and actual capacity are unknown",
        "No approved session host image, network or deprovision workflow",
    ]
    if payload.budget_ceiling_eur == 0:
        blockers.append("No positive spending ceiling supplied")
    return LabPreflightOut(
        policy_version="inc-campus-labs-v0",
        status="blocked",
        provisionable=False,
        cloud_resources_created=False,
        academic_module_code=payload.academic_module_code,
        template=payload.template,
        requested_hours=payload.requested_hours,
        budget_ceiling_eur=payload.budget_ceiling_eur,
        actual_cost_known=False,
        blockers=blockers,
    )
