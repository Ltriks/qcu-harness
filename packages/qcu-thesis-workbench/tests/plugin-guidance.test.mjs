import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {apply} from '../plugin/index.js';

test('local tools give panel guidance without exposing report origins or download links', async () => {
  const home = await mkdtemp(join(tmpdir(), 'qcu-guidance-'));
  const path = join(home, 'bridge.json');
  const origin = 'http://127.0.0.1:12345';
  await writeFile(path, JSON.stringify({base_url: origin, token: 't'.repeat(64)}));
  const rows = new Map();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return {ok: true, json: async () => ({report_id: 'a'.repeat(32), rule_source: 'demo', counts: {passed: 1, failed: 0, unknown: 2}, excerpt: 'PRIVATE-CANARY'})};
  };
  const dispose = apply({tools: {
    guard: () => () => {},
    register: row => {rows.set(row.name, row); return () => rows.delete(row.name);},
  }, on: () => () => {}}, {bridgePath: path});
  try {
    const opened = await rows.get('qcu_thesis_open').execute({});
    assert.equal(opened.workbench_access, 'native-panel');
    assert.equal(calls, 0);
    const checked = await rows.get('qcu_thesis_check').execute({document_id: 'b'.repeat(32), rule_id: 'demo'});
    assert.equal(checked.report_access, 'native-panel');
    assert.deepEqual(checked.counts, {passed: 1, failed: 0, unknown: 2});
    for (const output of [opened, checked]) {
      const text = JSON.stringify(output);
      assert.doesNotMatch(text, /https?:|\/reports\/|PRIVATE-CANARY|report_url|workbench_url/);
      assert.match(text, /论文检查/);
    }
    assert.match(checked.message, /取消后可再次保存/);
    assert.match(rows.get('qcu_thesis_open').description, /普通问候/);
    assert.match(rows.get('qcu_thesis_check').description, /普通聊天和切换话题不调用/);
  } finally {
    dispose(); globalThis.fetch = originalFetch; await rm(home, {recursive: true, force: true});
  }
});
