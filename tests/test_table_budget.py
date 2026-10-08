"""Synthetic generation-budget regression; no private inputs or network."""
import hashlib
import subprocess
import sys
from test_skills import Case, audit, BASE


class BudgetTests(Case):
    limits = dict(rows=100, columns=8, issues=100, report_bytes=100000)

    def rejected(self, text, **limits):
        source = self.write('input.csv', text)
        before = hashlib.sha256(source.read_bytes()).hexdigest()
        with self.assertRaises(ValueError):
            audit.audit(source, self.root / 'out', limits={**self.limits, **limits})
        self.assertFalse((self.root / 'out').exists())
        self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), before)

    def test_row_limit(self):
        self.rejected('id\n1\n2\n3\n', rows=2)

    def test_column_limit(self):
        self.rejected('a,b,c\n1,2,3\n', columns=2)

    def test_issue_limit(self):
        self.rejected('a,b\n,\n,\n', issues=2)

    def test_report_limit_before_output_creation(self):
        self.rejected('a\n \n', report_bytes=100)

    def test_small_input_large_report_rejected_before_disk_write(self):
        self.rejected('a,b\n' + ',\n' * 1000, rows=1000, issues=4000, report_bytes=10000)

    def test_generated_aggregate_within_budget_source_unchanged(self):
        source = self.write('input.csv', 'id,name\n0001, 合成甲 \n')
        before = source.read_bytes()
        result = audit.audit(source, self.root / 'out', limits=self.limits)
        self.assertEqual(result['rows'], 1)
        self.assertEqual(source.read_bytes(), before)
        self.assertLessEqual(sum(p.stat().st_size for p in (self.root / 'out').iterdir()), self.limits['report_bytes'])
        self.assertFalse((self.root / 'out/cleaned.csv').exists())

    def test_invalid_partial_budget_and_clean_mode(self):
        source = self.write('input.csv', 'id\n0001\n')
        for limits in [{'rows': 1}, {**self.limits, 'issues': True}, {**self.limits, 'rows': 0}]:
            with self.subTest(limits=limits), self.assertRaises(ValueError):
                audit.audit(source, self.root / 'out', limits=limits)
        with self.assertRaises(ValueError):
            audit.audit(source, self.root / 'out', clean=True, limits=self.limits)
        self.assertFalse((self.root / 'out').exists())

    def test_cli_budget_refuses_without_output(self):
        source = self.write('input.csv', 'id\n1\n2\n')
        result = subprocess.run([sys.executable, '-B', str(BASE / 'skills/qcu-table-audit/scripts/audit.py'),
            str(source), '--out', str(self.root / 'out'), '--max-rows', '1', '--max-columns', '8',
            '--max-issues', '100', '--max-report-bytes', '100000'], capture_output=True)
        self.assertEqual(result.returncode, 2)
        self.assertFalse((self.root / 'out').exists())
