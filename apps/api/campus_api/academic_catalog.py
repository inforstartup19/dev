"""Synthetic-safe Campus module templates grounded in public academic sources.

This is a read-only pilot catalogue, NOT enrollment, LMS, course management or VDI.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from campus_api.auth import require_private_context

router = APIRouter(
    prefix="/v1/campus/module-templates",
    tags=["university course templates"],
    dependencies=[Depends(require_private_context)],
)
Area = Literal["software", "data", "infrastructure", "innovation"]
LabKind = Literal["web_ide", "sql_sandbox", "jupyter", "linux_lab", "project_workspace"]

SOURCE = "https://www.fib.upc.edu/ca/graus/grau-en-enginyeria-informatica/pla-destudis/assignatures"


class ModuleTemplate(BaseModel):
    institution: Literal["UPC-FIB"]
    academic_year: Literal["2026-2027"]
    course_code: str
    title: str
    area: Area
    suggested_lab: LabKind
    source_url: str
    source_status: Literal["public_reference"]
    catalog_type: Literal["academic_example"]
    is_provisionable: Literal[False]


COURSES = (
    ("270001", "Programació I", "software", "web_ide"),
    ("270010", "Bases de Dades", "data", "sql_sandbox"),
    ("270023", "Intel·ligència Artificial", "data", "jupyter"),
    ("270067", "Centres de Processament de Dades", "infrastructure", "linux_lab"),
    ("270084", "Gestió de Projectes de Software", "software", "project_workspace"),
    ("270085", "Projecte d'Enginyeria del Software", "software", "web_ide"),
    ("270109", "Viabilitat de Projectes Empresarials", "innovation", "project_workspace"),
)

CATALOG = tuple(
    ModuleTemplate(
        institution="UPC-FIB",
        academic_year="2026-2027",
        course_code=code,
        title=title,
        area=area,
        suggested_lab=lab,
        source_url=SOURCE,
        source_status="public_reference",
        catalog_type="academic_example",
        is_provisionable=False,
    )
    for code, title, area, lab in COURSES
)


@router.get("", response_model=list[ModuleTemplate])
def module_templates(area: Area | None = Query(default=None)):
    """No student, course-enrollment or infrastructure data is exposed."""
    return [item for item in CATALOG if area is None or item.area == area]


@router.get("/{course_code}", response_model=ModuleTemplate)
def module_template(course_code: str):
    item = next((row for row in CATALOG if row.course_code == course_code), None)
    if item is None:
        raise HTTPException(404, "Academic example not found")
    return item
