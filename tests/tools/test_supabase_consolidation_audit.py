import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('audit', ROOT / 'scripts/audit_supabase_consolidation.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.plan = json.loads((ROOT / 'supabase/audit/consolidation-plan.json').read_text())
        self.snapshot = json.loads((ROOT / 'supabase/audit/dev-catalog.json').read_text())

    def test_known_inventory_does_not_authorize_cutover(self):
        result = MODULE.audit(ROOT, self.plan, self.snapshot)
        self.assertEqual(result['issues'], [])
        self.assertEqual(result['backend_table_count'], 37)
        self.assertEqual(result['alembic_heads'], ['0014'])
        self.assertEqual(result['cutover_status'], 'not_authorized_by_this_audit')
        self.assertTrue(result['remaining_gates'])

    def test_wrong_project_and_rls_regression(self):
        self.snapshot['project_id'] = 'bf-must-not-be-used'
        self.snapshot['tables'][0]['rls'] = False
        result = MODULE.audit(ROOT, self.plan, self.snapshot)
        self.assertIn('wrong_supabase_project', result['issues'])
        self.assertIn('unprotected_supabase_table:qc_projects', result['issues'])

    def test_new_and_removed_tables_require_reconciliation(self):
        self.plan['backend_tables'].pop('users')
        self.snapshot['tables'].pop()
        self.snapshot['tables'].append({'name': 'unexpected', 'rls': True, 'policies': 1})
        issues = MODULE.audit(ROOT, self.plan, self.snapshot)['issues']
        self.assertIn('unmapped_backend_table:users', issues)
        self.assertIn('missing_supabase_table:qc_submissions', issues)
        self.assertIn('unexpected_supabase_table:unexpected', issues)

    def test_migration_source_is_parsed_not_executed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            models = root / 'apps/api/campus_api/models.py'
            models.parent.mkdir(parents=True)
            models.write_text("raise RuntimeError('must never run')\nclass User:\n __tablename__='users'\n")
            migrations = root / 'apps/api/migrations/versions'
            migrations.mkdir(parents=True)
            (migrations / 'a.py').write_text("raise RuntimeError('must never run')\nrevision='a'\ndown_revision='b'\n")
            (migrations / 'b.py').write_text("revision='b'\ndown_revision='a'\n")
            result = MODULE.audit(root, copy.deepcopy(self.plan), self.snapshot)
            self.assertIn('migration_cycle', result['issues'])


if __name__ == '__main__':
    unittest.main()
