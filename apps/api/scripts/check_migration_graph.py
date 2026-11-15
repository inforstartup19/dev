#!/usr/bin/env python3
"""Fail closed when multiple Alembic migration files share a revision ID.

Stdlib only. Run: python apps/api/scripts/check_migration_graph.py
This checks revision graph structure; it does not execute upgrade/downgrade.
"""
from __future__ import annotations

import ast
import pathlib
import sys

MIGRATIONS = pathlib.Path(__file__).resolve().parents[1] / "migrations" / "versions"


def literal_assignment(tree: ast.AST, name: str):
    for node in getattr(tree, "body", ()):
        if isinstance(node, ast.Assign):
            if any(isinstance(target, ast.Name) and target.id == name for target in node.targets):
                return ast.literal_eval(node.value)
    raise ValueError(f"Missing {name}")


def check_graph(directory: pathlib.Path) -> list[str]:
    issues: list[str] = []
    revisions: dict[str, pathlib.Path] = {}
    dependencies: dict[str, str | None] = {}
    for path in sorted(directory.glob("*.py")):
        if path.name == "__init__.py":
            continue
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            revision = literal_assignment(tree, "revision")
            down_revision = literal_assignment(tree, "down_revision")
        except (SyntaxError, ValueError, TypeError) as exc:
            issues.append(f"{path.name}: cannot parse Alembic revision ({exc})")
            continue
        if not isinstance(revision, str):
            issues.append(f"{path.name}: revision must be a string")
            continue
        if revision in revisions:
            issues.append(
                f"duplicate revision {revision!r}: {revisions[revision].name} and {path.name}"
            )
        else:
            revisions[revision] = path
        if down_revision is not None and not isinstance(down_revision, str):
            issues.append(f"{path.name}: non-linear down_revision requires explicit review")
        dependencies[revision] = down_revision
    for revision, parent in dependencies.items():
        if parent is not None and parent not in revisions:
            issues.append(f"{revisions[revision].name}: missing ancestor {parent!r}")
    if len(revisions) > 1:
        heads = sorted(set(revisions) - {parent for parent in dependencies.values() if parent})
        if len(heads) != 1:
            issues.append(f"expected exactly one Alembic head, found {heads}")
    return issues


def main() -> int:
    if not MIGRATIONS.is_dir():
        print(f"ERROR: migration directory missing: {MIGRATIONS}", file=sys.stderr)
        return 1
    errors = check_graph(MIGRATIONS)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("OK: migration graph has unique revisions, present ancestors and one head")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
