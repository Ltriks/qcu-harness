"""Behavioral regression tests; no network, credentials or real personal data."""
import copy
import csv
import importlib.util
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parents[1]


def module(skill, script):
    spec = importlib.util.spec_from_file_location(script, BASE / 'skills' / skill / 'scripts' / (script + '.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


audit = module('qcu-table-audit', 'audit')
diff = module('qcu-document-diff', 'compare')
meeting = module('qcu-meeting-actions', 'actions')


class Case(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, name, text):
        path = self.root / name
        path.write_text(text, encoding='utf-8')
        return path

    def docx(self, name, body):
        # Minimal OOXML input fixture; not an authored deliverable or visual test.
        path = self.root / name
        xml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + '</w:body></w:document>'
        with zipfile.ZipFile(path, 'w') as archive:
            archive.writestr('word/document.xml', xml)
        return path


class TableTests(Case):
    def test_clean_preserves_id_and_source(self):
        folder = BASE / 'skills/qcu-table-audit/examples'
        source = folder / 'input.csv'
        before = source.read_bytes()
        rules = json.loads((folder / 'rules.json').read_text())
        result = audit.audit(source, self.root / 'out', rules, True)
        self.assertEqual(source.read_bytes(), before)
        with (self.root / 'out/cleaned.csv').open(encoding='utf-8-sig', newline='') as f:
            rows = list(csv.reader(f))
        self.assertEqual(rows[1], ['0007', '示例甲', '2026-09-01', '2'])
        self.assertEqual(len(rows), 4)
        self.assertEqual(result['counts']['invalid_date'], 1)
        self.assertEqual(result['counts']['invalid_number'], 1)
        self.assertEqual(result['counts']['required_missing'], 1)
        self.assertEqual(result['counts']['duplicate_row'], 1)
        self.assertEqual(result['counts']['duplicate_key'], 1)
        self.assertEqual({i['row'] for i in result['remaining_issues']}, {3, 5})

    def test_audit_does_not_clean(self):
        source = self.write('input.csv', 'id,name\n0001, A \n')
        result = audit.audit(source, self.root / 'out', {'columns': {'name': {'trim': True}}})
        self.assertEqual(result['changes'], [])
        self.assertFalse((self.root / 'out/cleaned.csv').exists())

    def test_empty_and_bad_headers(self):
        for i, text in enumerate(['', 'id,id\n1,2\n', 'id, id\n1,2\n', ',name\n1,A\n']):
            with self.assertRaises(ValueError):
                audit.audit(self.write(f'{i}.csv', text), self.root / f'out{i}')

    def test_ragged_csv_rejected(self):
        with self.assertRaises(ValueError):
            audit.audit(self.write('a.csv', 'id,name\n1,A,extra\n'), self.root / 'out')
        self.assertFalse((self.root / 'out').exists())

    def test_newlines_and_formula_text_preserved(self):
        source = self.write('a.csv', 'id,note\n0001,"first\nsecond"\n0002,=1+2\n')
        result = audit.audit(source, self.root / 'out', {}, True)
        self.assertEqual(result['issues'], [dict(row=3, column='note', code='formula_like_text')])
        with (self.root / 'out/cleaned.csv').open(encoding='utf-8-sig', newline='') as f:
            rows = list(csv.reader(f))
        self.assertEqual(rows[1][1], 'first\nsecond')
        self.assertEqual(rows[2][1], '=1+2')

    def test_tsv_and_nonfinite_numbers(self):
        result = audit.audit(self.write('a.tsv', 'id\tvalue\n0001\tNaN\n0002\tInfinity\n'),
                             self.root / 'out', {'columns': {'value': {'type': 'number'}}}, True)
        self.assertEqual(result['counts']['invalid_number'], 2)
        self.assertTrue((self.root / 'out/cleaned.tsv').exists())

    def test_normalization_does_not_merge_distinct_raw_rows(self):
        rules = {'columns': {'name': {'trim': True}}, 'drop_exact_duplicates': True}
        result = audit.audit(self.write('a.csv', 'name\n A\nA\n'), self.root / 'out', rules, True)
        self.assertEqual(result['output_rows'], 2)
        self.assertEqual(result['remaining_issues'][0]['code'], 'duplicate_row')

    def test_bad_rules_and_overwrite_rejected(self):
        source = self.write('a.csv', 'id\n0001\n')
        for rules in [{'columns': {'missing': {}}}, {'unique_keys': [['bad']]},
                      {'columns': {'id': {'type': 'date'}}}, {'drop_exact_duplicates': 'false'}]:
            with self.assertRaises(ValueError):
                audit.audit(source, self.root / 'out', rules)
        with self.assertRaises(ValueError):
            audit.audit(source, self.root)


class DiffTests(Case):
    def test_insert_delete_replace_and_source_unchanged(self):
        old = self.write('old.md', 'remove\nanchor1\nold\nanchor2\n')
        new = self.write('new.md', 'anchor1\nnew\nanchor2\nadded\n')
        before = old.read_bytes()
        result = diff.compare(old, new, self.root / 'out')
        self.assertEqual({c['kind'] for c in result['changes']}, {'delete', 'replace', 'insert'})
        self.assertEqual(result['changes'][0]['before'][0]['location'], 'line:1')
        self.assertEqual(old.read_bytes(), before)

    def test_identical_and_whitespace(self):
        a = self.write('a.txt', 'a\n')
        b = self.write('b.txt', 'a\n')
        self.assertEqual(diff.compare(a, b, self.root / 'same')['changes'], [])
        b.write_text(' a\n')
        self.assertEqual(len(diff.compare(a, b, self.root / 'spaces')['changes']), 1)

    def test_docx_runs_and_table_location(self):
        prefix = '<w:p><w:r><w:t>split</w:t></w:r><w:r><w:t> runs</w:t></w:r></w:p>'
        def table(text):
            return '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'
        old = self.docx('a.docx', prefix + table('old'))
        new = self.docx('b.docx', prefix + table('new'))
        result = diff.compare(old, new, self.root / 'out')
        self.assertEqual(len(result['changes']), 1)
        self.assertEqual(result['changes'][0]['before'][0]['location'], 'body/table:1/row:1/cell:1/p:1')

    def test_docx_unsupported_structures_rejected(self):
        for i, content in enumerate(['<w:ins/>', '<w:sdt/>', '<w:p><w:r><w:fldChar/></w:r></w:p>']):
            with self.assertRaises(ValueError):
                diff.read_document(self.docx(f'{i}.docx', content))

    def test_excluded_parts_reported(self):
        source = self.docx('a.docx', '<w:p/>')
        with zipfile.ZipFile(source, 'a') as z:
            z.writestr('word/header1.xml', '<header/>')
        self.assertIn('word/header1.xml', diff.read_document(source)[1]['excluded_parts'])

    def test_bad_format_and_output_rejected(self):
        with self.assertRaises(ValueError):
            diff.read_document(self.write('a.pdf', 'not supported'))
        a = self.write('a.txt', 'a')
        with self.assertRaises(ValueError):
            diff.compare(a, a, self.root)


class MeetingTests(Case):
    def setUp(self):
        super().setUp()
        folder = BASE / 'skills/qcu-meeting-actions/examples'
        self.source = folder / 'transcript.txt'
        self.data = json.loads((folder / 'extracted.json').read_text())
        self.lines, _ = meeting.read_source(self.source)

    def test_example_and_unknown_fields(self):
        result = meeting.render(self.source, self.data, self.root / 'out')
        self.assertEqual(result['status'], 'draft')
        self.assertEqual(result['semantic_review'], 'required')
        self.assertIsNone(result['items'][3]['owner'])
        self.assertEqual(result['items'][1]['deadline'], '周五前')
        self.assertEqual(result['items'][2]['kind'], 'proposal')

    def test_invented_owner_or_date_rejected(self):
        for field, value in [('owner', '虚构负责人'), ('deadline', '2026-10-02')]:
            data = copy.deepcopy(self.data)
            data['items'][1][field] = value
            with self.assertRaises(ValueError):
                meeting.validate(self.lines, data)

    def test_truncated_quote_and_bad_line_rejected(self):
        for update in [{'quote': '建议下个月增加自动发邮件'}, {'start_line': 0}, {'end_line': 999}]:
            data = copy.deepcopy(self.data)
            data['items'][2]['evidence'].update(update)
            with self.assertRaises(ValueError):
                meeting.validate(self.lines, data)

    def test_wrong_shape_rejected(self):
        for data in [[], {'items': {}, 'uncertainties': []}, {'items': [], 'uncertainties': [None]}]:
            with self.assertRaises(ValueError):
                meeting.validate(self.lines, data)

    def test_numbering_and_no_overwrite(self):
        meeting.prepare(self.source, self.root / 'prep')
        self.assertTrue((self.root / 'prep/numbered.txt').read_text().startswith('0001 | '))
        with self.assertRaises(ValueError):
            meeting.prepare(self.source, self.root / 'prep')
        with self.assertRaises(ValueError):
            meeting.render(self.source, self.data, self.root)

    def test_empty_transcript_and_empty_items(self):
        with self.assertRaises(ValueError):
            meeting.read_source(self.write('empty.txt', '\n'))
        result = meeting.render(self.source, {'items': [], 'uncertainties': ['待人工提取']}, self.root / 'out')
        self.assertEqual(result['items'], [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
