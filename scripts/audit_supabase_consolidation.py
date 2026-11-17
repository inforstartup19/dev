#!/usr/bin/env python3
"""Offline, read-only consolidation inventory. Never opens a database connection.

Reads Python syntax without importing application/migration modules. Compares the
tracked reconciliation plan with source tables, migration graph and a catalog
snapshot collected separately through read-only Supabase metadata queries.
"""
import argparse
import ast
import json
from pathlib import Path


def assignments(path):
    result = {}
    for node in ast.walk(ast.parse(path.read_text())):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    try:
                        result[target.id] = ast.literal_eval(node.value)
                    except (ValueError, TypeError):
                        pass
    return result


def source_inventory(root):
    tree = ast.parse((root / 'apps/api/campus_api/models.py').read_text())
    tables = sorted(
        value.value.value
        for node in tree.body if isinstance(node, ast.ClassDef)
        for value in node.body if isinstance(value, ast.Assign)
        if any(isinstance(t, ast.Name) and t.id == '__tablename__' for t in value.targets)
        and isinstance(value.value, ast.Constant)
    )
    migrations = []
    for path in sorted((root / 'apps/api/migrations/versions').glob('*.py')):
        data = assignments(path)
        if 'revision' in data:
            migrations.append({'revision': data['revision'], 'parent': data.get('down_revision')})
    return tables, migrations


def audit(root, plan, snapshot):
    source, migrations = source_inventory(root)
    issues = []
    mapped = plan.get('backend_tables', {})
    actual = {row['name']: row for row in snapshot['tables']}
    expected = set(plan.get('supabase_tables', {}))
    for name in sorted(set(source) - set(mapped)):
        issues.append('unmapped_backend_table:' + name)
    for name in sorted(set(mapped) - set(source)):
        issues.append('stale_backend_mapping:' + name)
    for name in sorted(set(actual) - expected):
        issues.append('unexpected_supabase_table:' + name)
    for name in sorted(expected - set(actual)):
        issues.append('missing_supabase_table:' + name)
    for name, row in actual.items():
        if row.get('rls') is not True or row.get('policies', 0) < 1:
            issues.append('unprotected_supabase_table:' + name)
    revisions = [m['revision'] for m in migrations]
    if len(revisions) != len(set(revisions)):
        issues.append('duplicate_migration_revision')
    parents = set()
    graph = {}
    for migration in migrations:
        parent = migration['parent']
        values = parent if isinstance(parent, (tuple, list)) else ([parent] if parent else [])
        parents.update(values)
        graph[migration['revision']] = values
        for value in values:
            if value not in revisions:
                issues.append('missing_migration_parent:' + str(value))
    heads = sorted(set(revisions) - parents)
    if heads != plan.get('expected_alembic_heads'):
        issues.append('alembic_heads_changed')
    visiting, visited = set(), set()

    def visit(revision):
        if revision in visiting:
            raise ValueError('cycle')
        if revision in visited:
            return
        visiting.add(revision)
        for parent in graph.get(revision, []):
            visit(parent)
        visiting.remove(revision)
        visited.add(revision)

    try:
        for revision in graph:
            visit(revision)
    except ValueError:
        issues.append('migration_cycle')
    if snapshot.get('project_id') != plan.get('target_project_id'):
        issues.append('wrong_supabase_project')
    return {
        'inventory_status': 'drift' if issues else 'consistent',
        'cutover_status': 'not_authorized_by_this_audit',
        'backend_table_count': len(source),
        'supabase_table_count': len(actual),
        'alembic_heads': heads,
        'snapshot_observed_at': snapshot.get('observed_at'),
        'issues': issues,
        'remaining_gates': plan['remaining_gates'],
        'limitations': ['Snapshot is not a live database check.',
                       'No row migration, credentials, deployment or authorization change.',
                       'RLS flags and policy counts do not prove policy correctness.'],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--snapshot', type=Path)
    args = parser.parse_args()
    plan = json.loads((args.root / 'supabase/audit/consolidation-plan.json').read_text())
    snapshot = json.loads((args.snapshot or args.root / 'supabase/audit/dev-catalog.json').read_text())
    result = audit(args.root, plan, snapshot)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 1 if result['issues'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
