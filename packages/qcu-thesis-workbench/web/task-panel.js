(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const MAX_UPLOAD = 20 * 1024 * 1024;
  const SUMMARY_KEY = 'qcu-local-task-summary-v1';
  const sources = new Set(['demo', 'personal', 'center']);
  const state = {file: null, documentId: null, rules: [], busy: false, loadingRules: true,
    disposed: false, revision: 0, operation: null, rulesRequest: null};

  function selectedRule() { return state.rules.find(rule => rule.id === $('task-rule').value); }
  function updateControls() {
    const ready = Boolean(state.file && selectedRule() && !state.loadingRules && !state.disposed);
    $('task-document').disabled = state.busy || state.disposed;
    $('task-rule').disabled = state.busy || state.loadingRules || !state.rules.length || state.disposed;
    $('clear-file').disabled = state.busy || !state.file || state.disposed;
    $('local-authorized').disabled = state.busy || !ready;
    $('task-run').disabled = state.busy || !ready || !$('local-authorized').checked;
    $('task-run').textContent = state.busy ? '正在本机处理…' : '开始本次本机检查';
    $('reload-rules').disabled = state.loadingRules || state.busy || state.disposed;
    $('task-form').setAttribute('aria-busy', String(state.busy));
  }
  function focusCard(card) {
    card.focus({preventScroll: true});
    if (typeof card.scrollIntoView === 'function') card.scrollIntoView({block: 'nearest', behavior: 'auto'});
  }
  function removeSummary() { try { sessionStorage.removeItem(SUMMARY_KEY); } catch {} }
  function clearFeedback() {
    $('task-progress').hidden = true;
    $('task-error').hidden = true;
    $('task-result').hidden = true;
    $('task-report').removeAttribute('href');
    $('task-download').removeAttribute('href');
    $('task-notice').textContent = '';
    removeSummary();
  }
  function invalidate() {
    const wasBusy = state.busy;
    state.revision++;
    state.operation?.abort();
    state.operation = null;
    state.busy = false;
    $('local-authorized').checked = false;
    clearFeedback();
    if (wasBusy) $('task-notice').textContent = '选择已改变，旧请求不再显示结果；已经开始的本机计算不一定停止。';
  }
  function showError(message) {
    $('task-progress').hidden = true;
    $('task-result').hidden = true;
    $('error-message').textContent = message;
    $('task-error').hidden = false;
    focusCard($('task-error'));
  }
  function progress(title, detail) {
    $('progress-title').textContent = title;
    $('progress-detail').textContent = detail;
    $('task-progress').hidden = false;
  }
  function ruleDescription(source) {
    if (source === 'demo') return 'DEMO 演示规则，不是 QCU 正式规范；不构成正式合规结论。';
    if (source === 'personal') return '个人规则，不是 QCU 正式规范；不构成正式合规结论。';
    return '仅覆盖报告中列出的检查项，仍需人工复核未覆盖项。';
  }
  function updateRuleDescription() {
    const rule = selectedRule();
    $('rule-meta').textContent = rule
      ? `${ruleDescription(rule.source)} 版本 ${rule.version}`
      : 'DEMO / 个人规则不是 QCU 正式规范';
  }
  function summaryValid(summary) {
    return summary && typeof summary === 'object' && !Array.isArray(summary)
      && Object.keys(summary).sort().join(',') === 'counts,reportPath,ruleSource'
      && /^\/reports\/[0-9a-f]{32}$/.test(summary.reportPath)
      && sources.has(summary.ruleSource)
      && summary.counts && typeof summary.counts === 'object'
      && Object.keys(summary.counts).sort().join(',') === 'failed,passed,unknown'
      && ['passed', 'failed', 'unknown'].every(key => Number.isSafeInteger(summary.counts[key]) && summary.counts[key] >= 0);
  }
  function renderSummary(summary, restored = false) {
    for (const key of ['passed', 'failed', 'unknown']) $('count-' + key).textContent = String(summary.counts[key]);
    $('result-scope').textContent = ruleDescription(summary.ruleSource);
    $('result-context').textContent = restored
      ? '上次已完成检查的摘要。文件选择和授权未保留；新的检查需重新选择并授权。'
      : '本次仅按所选规则检查。再次检查前请重新勾选授权。';
    $('task-report').setAttribute('href', summary.reportPath);
    $('task-download').setAttribute('href', summary.reportPath + '/download');
    $('task-progress').hidden = true;
    $('task-error').hidden = true;
    $('task-result').hidden = false;
  }
  function restoreSummary() {
    try {
      const summary = JSON.parse(sessionStorage.getItem(SUMMARY_KEY));
      if (summaryValid(summary)) renderSummary(summary, true);
      else removeSummary();
    } catch { removeSummary(); }
  }
  async function api(path, options = {}) {
    const response = await fetch(path, {credentials: 'same-origin', cache: 'no-store', ...options});
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : '本机服务未完成请求，请重试。');
    return data;
  }

  async function loadRules() {
    if (state.loadingRules && state.rulesRequest) return;
    state.loadingRules = true;
    const request = new AbortController();
    state.rulesRequest = request;
    $('reload-rules').hidden = true;
    updateControls();
    try {
      const rules = await api('/api/rules', {signal: request.signal});
      if (state.disposed || request !== state.rulesRequest) return;
      if (!Array.isArray(rules) || !rules.length || rules.some(rule => !rule
          || typeof rule.id !== 'string' || !rule.id || typeof rule.name !== 'string'
          || typeof rule.version !== 'string' || !sources.has(rule.source))) {
        throw new Error('没有可用的检查规则，请重新读取规则。');
      }
      state.rules = rules;
      $('task-rule').replaceChildren(...rules.map(rule => {
        const option = document.createElement('option');
        option.value = rule.id;
        option.textContent = `${rule.source === 'demo' ? 'DEMO' : rule.source === 'personal' ? '个人规则' : '中心规则'} · ${rule.name}`;
        return option;
      }));
      $('task-error').hidden = true;
      updateRuleDescription();
    } catch (error) {
      if (state.disposed || request !== state.rulesRequest) return;
      state.rules = [];
      $('reload-rules').hidden = false;
      showError(error.message || '规则读取失败，请重试。');
    } finally {
      if (!state.disposed && request === state.rulesRequest) {
        state.rulesRequest = null;
        state.loadingRules = false;
        updateControls();
      }
    }
  }

  function clearFile(message = '还没有选择文件') {
    invalidate();
    state.file = null;
    state.documentId = null;
    $('task-document').value = '';
    $('file-state').textContent = message;
    updateControls();
  }
  // Invalidate before opening the picker too: cancellation cannot reuse old consent.
  $('task-document').onclick = () => { if (!state.busy) clearFile('请选择 DOCX 文件；取消选择不会开始检查'); };
  $('task-document').oncancel = () => clearFile('已取消文件选择，请重新选择');
  $('task-document').onchange = () => {
    invalidate();
    state.file = null;
    state.documentId = null;
    const file = $('task-document').files?.[0];
    if (!file) $('file-state').textContent = '还没有选择文件';
    else if (!/\.docx$/i.test(file.name) || !file.size || file.size > MAX_UPLOAD) {
      $('task-document').value = '';
      $('file-state').textContent = '文件未载入';
      showError('请选择非空的 DOCX 文件，大小不超过 20 MB。');
    } else {
      state.file = file;
      $('file-state').textContent = `已选择：${file.name}`;
    }
    updateControls();
  };
  $('clear-file').onclick = () => clearFile();
  $('task-rule').onchange = () => { invalidate(); updateRuleDescription(); updateControls(); };
  $('local-authorized').onchange = updateControls;
  $('reload-rules').onclick = loadRules;

  $('task-form').onsubmit = async event => {
    event.preventDefault();
    const rule = selectedRule();
    if (state.disposed || state.busy || state.loadingRules || !state.file || !rule || !$('local-authorized').checked) return;
    clearFeedback();
    state.busy = true;
    $('local-authorized').checked = false; // Consent covers exactly this attempt, including errors.
    const revision = ++state.revision;
    const controller = new AbortController();
    state.operation = controller;
    const file = state.file;
    const active = () => !state.disposed && state.revision === revision && !controller.signal.aborted;
    updateControls();
    progress('正在本机读取 DOCX', '正在准备所选文件。请保持面板打开；不会调用模型或发送对话消息。');
    focusCard($('task-progress'));
    try {
      if (!state.documentId) {
        const uploaded = await api('/api/task/upload', {method: 'POST', signal: controller.signal,
          headers: {'Content-Type': 'application/octet-stream', 'X-QCU-Chat-Allowed': 'false'}, body: file});
        if (!active()) return;
        if (!/^[0-9a-f]{32}$/.test(uploaded.document_id) || uploaded.chat_allowed !== false) {
          throw new Error('本机文件响应不完整，请重新选择文件。');
        }
        state.documentId = uploaded.document_id;
      }
      if (!active()) return;
      progress('正在本机检查格式', '正在按所选规则计算检查结果并生成本机报告。');
      const result = await api('/api/task/run', {method: 'POST', signal: controller.signal,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({document_id: state.documentId, rule_id: rule.id, local_authorized: true})});
      if (!active()) return;
      const summary = {counts: result.counts, reportPath: result.report_url, ruleSource: result.rule_source};
      if (result.status !== 'completed' || !/^[0-9a-f]{32}$/.test(result.report_id)
          || result.report_url !== '/reports/' + result.report_id || !summaryValid(summary)) {
        throw new Error('本机结果响应不完整，请重新勾选授权后重试。');
      }
      renderSummary(summary);
      try { sessionStorage.setItem(SUMMARY_KEY, JSON.stringify(summary)); } catch {}
      focusCard($('task-result'));
    } catch (error) {
      if (active()) showError(error.message || '本机检查失败，请重新勾选授权后重试。');
    } finally {
      if (active()) { state.busy = false; state.operation = null; updateControls(); }
    }
  };

  function dispose() {
    state.disposed = true;
    state.revision++;
    state.operation?.abort();
    state.rulesRequest?.abort();
    state.operation = state.rulesRequest = null;
    state.busy = false;
    state.file = null;
    state.documentId = null;
    $('local-authorized').checked = false;
    $('task-document').value = '';
    updateControls();
  }
  window.addEventListener('pagehide', dispose);
  window.addEventListener('beforeunload', dispose);
  window.addEventListener('pageshow', event => {
    $('local-authorized').checked = false;
    if (event.persisted) {
      state.disposed = false;
      state.loadingRules = false;
      $('task-progress').hidden = true;
      $('task-error').hidden = true;
      $('file-state').textContent = '还没有选择文件';
      restoreSummary();
      if (!state.rules.length) loadRules();
    }
    updateControls();
  });
  $('local-authorized').checked = false;
  restoreSummary();
  loadRules();
})();
