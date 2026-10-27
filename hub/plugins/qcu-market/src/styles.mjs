// Shared slot styles, including the retained legacy plugin selectors below.
// Structure borrows RawBlock; colors and interaction states inherit official rc.2 tokens.
export const marketStyles = `
.qcu-market { --qcu-market-font:var(--dsh-content-font-size,14px);min-width:0;max-width:100%;box-sizing:border-box;height:100%;overflow:auto;padding:20px clamp(16px,3vw,32px) 40px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-family:var(--dsw-font-family,system-ui,sans-serif);font-size:var(--qcu-market-font);line-height:1.6; }
.qcu-market * { box-sizing:border-box; }
.qcu-market .qcu-content { max-width:1040px;margin:0 auto; }
.qcu-market h1 { margin:0;font-size:calc(var(--qcu-market-font) * 24 / 14);line-height:calc(var(--qcu-market-font) * 32 / 14);font-weight:650; }
.qcu-market h2 { margin:0;font-size:calc(var(--qcu-market-font) * 16 / 14);line-height:calc(var(--qcu-market-font) * 24 / 14);font-weight:600; }
.qcu-market p { line-height:1.6; }
.qcu-market :is(h1,h2,p,label) { overflow-wrap:anywhere; }
.qcu-market .qcu-muted,.qcu-market .qcu-hint { color:var(--dsw-alias-label-secondary); }
.qcu-market .qcu-hint { font-size:calc(var(--qcu-market-font) * 12 / 14);margin:8px 0 0; }
.qcu-market .qcu-eyebrow { font-size:calc(var(--qcu-market-font) * 11 / 14);letter-spacing:0;font-weight:650;color:var(--dsw-alias-brand-text); }
.qcu-market .qcu-app-header { display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:16px;border-bottom:1px solid var(--dsw-alias-border-l3); }
.qcu-market .qcu-wordmark { display:flex;align-items:center;gap:10px;font-size:calc(var(--qcu-market-font) * 17 / 14);font-weight:650; }
.qcu-market .qcu-exit { flex:none;color:var(--dsw-alias-label-secondary); }
.qcu-market .qcu-page-nav { display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 24px; }
.qcu-market .qcu-page-nav .qcu-control { border-color:transparent; }
.qcu-market .qcu-page-nav .qcu-control[aria-pressed="true"] { border-color:var(--dsw-alias-brand-primary); }
.qcu-market .qcu-home-intro { margin:0 0 16px; }
.qcu-market .qcu-home-intro p { margin:4px 0 0;font-size:calc(var(--qcu-market-font) * 13 / 14); }
.qcu-market .qcu-onboarding { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;margin:0 0 20px;border:1px solid var(--dsw-alias-border-l3);border-radius:10px;border-left:3px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-1); }
.qcu-market .qcu-onboarding h2 { font-size:var(--qcu-market-font);line-height:calc(var(--qcu-market-font) * 22 / 14); }
.qcu-market .qcu-onboarding .qcu-hint { margin-top:2px; }
.qcu-market .qcu-onboarding .qcu-control { flex:none; }
.qcu-market button,.qcu-market summary { font:inherit; }
.qcu-market .qcu-control { display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:36px;max-width:100%;padding:7px 12px;border:1px solid var(--dsw-alias-border-l3);border-radius:4px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;font-size:calc(var(--qcu-market-font) * 13 / 14);line-height:calc(var(--qcu-market-font) * 20 / 14); }
.qcu-market .qcu-control:hover { background:var(--dsw-alias-interactive-bg-hover); }
.qcu-market .qcu-control:active { background:var(--dsw-alias-interactive-bg-active); }
.qcu-market .qcu-control[aria-pressed="true"] { background:var(--dsw-alias-button-ghost-active-fill);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-text); }
.qcu-market .qcu-primary { background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border-color:transparent; }
.qcu-market .qcu-primary:hover { background:var(--dsw-alias-button-primary-hover); }
.qcu-market button:disabled { color:var(--dsw-alias-label-secondary);border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);cursor:not-allowed; }
.qcu-market :is(button,summary,textarea,input,pre):focus-visible { outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px; }
.qcu-market [data-page-heading]:focus { outline:none; }
.qcu-market .qcu-toolbar { display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap; }
.qcu-market .qcu-tabs { display:flex;gap:4px;flex-wrap:wrap; }
.qcu-market .qcu-tabs button { min-height:36px;padding:7px 16px;border:1px solid transparent;border-radius:4px;color:inherit;background:transparent;cursor:pointer;font-size:calc(var(--qcu-market-font) * 13 / 14);line-height:calc(var(--qcu-market-font) * 20 / 14); }
.qcu-market .qcu-tabs button[aria-pressed="true"] { border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2); }
.qcu-market .qcu-search { display:flex;align-items:center;gap:10px;flex:0 1 320px;min-width:0;font-size:calc(var(--qcu-market-font) * 13 / 14); }
.qcu-market .qcu-search input { min-width:0;flex:1;width:100%;min-height:36px;padding:7px 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:4px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);font:inherit; }
.qcu-market .qcu-search input::placeholder { color:var(--dsw-alias-label-secondary); }
.qcu-market .qcu-count { color:var(--dsw-alias-label-secondary);font-size:calc(var(--qcu-market-font) * 12 / 14);margin:12px 0; }
.qcu-market .qcu-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start; }
.qcu-market .qcu-grid > div { min-width:0; }
.qcu-market .qcu-product { border:1px solid var(--dsw-alias-border-l3);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden; }
.qcu-market .qcu-product:hover { border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-interactive-bg-hover); }
.qcu-market .qcu-card-link { display:grid;gap:10px;width:100%;min-height:148px;padding:14px;text-align:left;border:0;color:inherit;background:transparent;cursor:pointer; }
.qcu-market .qcu-card-link:focus-visible { outline-offset:-3px; }
.qcu-market .qcu-card-title { display:flex;align-items:center;gap:10px;min-width:0; }
.qcu-market .qcu-card-title h2 { font-size:calc(var(--qcu-market-font) * 15 / 14);line-height:calc(var(--qcu-market-font) * 22 / 14); }
.qcu-market .qcu-icon-tile { display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;flex:none;border-radius:4px;color:var(--dsw-alias-brand-text);background:var(--dsw-alias-button-ghost-active-fill); }
.qcu-market .qcu-icon-tile svg { width:22px;height:22px; }
.qcu-market .qcu-summary { display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:42px;margin:0;color:var(--dsw-alias-label-secondary);font-size:calc(var(--qcu-market-font) * 13 / 14);line-height:calc(var(--qcu-market-font) * 21 / 14); }
.qcu-market .qcu-card-footer { display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap; }
.qcu-market .qcu-badge { padding:1px 6px;border-radius:2px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:calc(var(--qcu-market-font) * 11 / 14);line-height:calc(var(--qcu-market-font) * 20 / 14); }
.qcu-market .qcu-status { display:inline-block;margin:0;font-size:calc(var(--qcu-market-font) * 12 / 14);line-height:calc(var(--qcu-market-font) * 20 / 14);color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere; }
.qcu-market details { margin-top:12px; }
.qcu-market summary { min-height:36px;padding:7px 0;cursor:pointer;line-height:calc(var(--qcu-market-font) * 22 / 14); }
.qcu-market .qcu-technical { margin-top:28px;border-top:1px solid var(--dsw-alias-border-l2);padding-top:16px;color:var(--dsw-alias-label-secondary);font-size:calc(var(--qcu-market-font) * 12 / 14);overflow-wrap:anywhere; }
.qcu-market .qcu-technical summary { font-size:calc(var(--qcu-market-font) * 12 / 14); }
.qcu-market .qcu-diagnostic { padding-top:16px; }
.qcu-market .qcu-empty { padding:40px 20px;text-align:center;color:var(--dsw-alias-label-secondary);border:1px dashed var(--dsw-alias-border-l3);border-radius:4px; }
.qcu-market .qcu-empty h2 { margin:12px 0 4px;color:var(--dsw-alias-label-primary); }
.qcu-market .qcu-detail,.qcu-market .qcu-aux-page { max-width:760px;margin:0 auto; }
.qcu-market .qcu-detail-head { min-width:0;display:flex;align-items:center;gap:14px;margin:24px 0 16px; }
.qcu-market .qcu-detail-head>div { min-width:0; }
.qcu-market .qcu-detail-head h1 { font-size:calc(var(--qcu-market-font) * 24 / 14);margin:4px 0; }
.qcu-market .qcu-detail-head p { margin:4px 0 0;font-size:calc(var(--qcu-market-font) * 13 / 14); }
.qcu-market .qcu-icon-large { width:44px;height:44px; }
.qcu-market .qcu-icon-large svg { width:26px;height:26px; }
.qcu-market .qcu-purpose { font-size:calc(var(--qcu-market-font) * 15 / 14); }
.qcu-market .qcu-actions { padding:16px;border:1px solid var(--dsw-alias-border-l3);border-radius:4px;margin:20px 0;background:var(--dsw-alias-bg-layer-1); }
.qcu-market .qcu-button-row { display:flex;gap:10px;flex-wrap:wrap;margin-top:12px; }
.qcu-market .qcu-review { padding:20px;border:1px solid var(--dsw-alias-brand-primary);border-left-width:3px;border-radius:4px;background:var(--dsw-alias-bg-layer-1);font-size:calc(var(--qcu-market-font) * 13 / 14); }
.qcu-market .qcu-hash { overflow-wrap:anywhere; }
.qcu-market .qcu-section { margin-top:24px;padding-top:20px;border-top:1px solid var(--dsw-alias-border-l2); }
.qcu-market .qcu-section h2 { margin-bottom:12px; }
.qcu-market textarea { display:block;width:100%;resize:vertical;min-height:115px;padding:12px;margin:12px 0;font:inherit;font-size:calc(var(--qcu-market-font) * 13 / 14);line-height:1.8;color:inherit;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l3);border-radius:4px;user-select:text; }
.qcu-market .qcu-facts { margin:0; }
.qcu-market .qcu-facts > div { display:grid;grid-template-columns:90px minmax(0,1fr);gap:16px;margin:12px 0; }
.qcu-market dt { color:var(--dsw-alias-label-secondary); }
.qcu-market dd { margin:0;overflow-wrap:anywhere; }
.qcu-market .qcu-note { padding:12px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;background:var(--dsw-alias-bg-layer-1);font-size:calc(var(--qcu-market-font) * 13 / 14);color:var(--dsw-alias-label-secondary); }
.qcu-market .qcu-guide-status { margin:6px 0 20px;color:var(--dsw-alias-label-secondary);font-size:calc(var(--qcu-market-font) * 13 / 14); }
.qcu-market .qcu-progress { display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:0 0 24px;padding:0;list-style:none; }
.qcu-market .qcu-progress li { display:flex;flex-direction:column;gap:8px;padding:10px 8px;border-top:2px solid var(--dsw-alias-border-l3);font-size:calc(var(--qcu-market-font) * 12 / 14);color:var(--dsw-alias-label-secondary); }
.qcu-market .qcu-progress li[aria-current="step"] { border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-text);background:var(--dsw-alias-button-ghost-active-fill);font-weight:600; }
.qcu-market .qcu-step-number { font-variant-numeric:tabular-nums;font-weight:650; }
.qcu-market .qcu-guide-body { border-top:1px solid var(--dsw-alias-border-l2);padding-top:20px; }
.qcu-market .qcu-guide-body h2 { margin-top:4px;font-size:calc(var(--qcu-market-font) * 20 / 14);line-height:calc(var(--qcu-market-font) * 28 / 14); }
.qcu-market .qcu-guide-controls { display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:24px;padding-top:16px;border-top:1px solid var(--dsw-alias-border-l3); }
.qcu-market .qcu-guide-controls .qcu-button-row { margin:0; }
.qcu-market .qcu-field { margin:18px 0; }
.qcu-market .qcu-field textarea { min-height:72px;margin:6px 0; }
.qcu-market .qcu-field label { font-weight:600; }
.qcu-market .qcu-ack { display:flex;align-items:flex-start;gap:10px;margin:18px 0; }
.qcu-market .qcu-ack input { flex:none;margin-top:6px; }
.qcu-market .qcu-head { display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin:24px 0; }
.qcu-market .qcu-intro { margin:6px 0 0;color:var(--dsw-alias-label-secondary);font-size:var(--qcu-market-font); }
.qcu-market .qcu-filters { display:flex;flex-wrap:wrap;gap:8px;margin:24px 0 12px; }
.qcu-market .qcu-card { min-width:0;padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;background:var(--dsw-alias-bg-layer-1); }
.qcu-market .qcu-card-top { display:flex;align-items:center;gap:12px;margin-bottom:12px; }
.qcu-market .qcu-card-heading { min-width:0; }
.qcu-market .qcu-card .qcu-summary { display:block;min-height:0;overflow:visible;margin-bottom:18px; }
.qcu-market .qcu-guide > summary { padding:9px 12px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);font-size:var(--qcu-market-font); }
.qcu-market .qcu-guide[data-official="true"] > summary { color:var(--dsw-alias-label-primary-foreground);background:var(--dsw-alias-button-primary-fill); }
.qcu-market .qcu-guide[data-official="true"] > summary:hover { background:var(--dsw-alias-button-primary-hover); }
.qcu-market .qcu-guide > div { padding:4px 0; }
.qcu-market .qcu-guide p { font-size:calc(var(--qcu-market-font) * 13 / 14);color:var(--dsw-alias-label-secondary); }
.qcu-market pre { white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;padding:12px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);font:inherit;font-size:calc(var(--qcu-market-font) * 13 / 14);line-height:1.6; }
.qcu-market .qcu-meta { border-top:1px solid var(--dsw-alias-border-l2);padding-top:12px;font-size:calc(var(--qcu-market-font) * 12 / 14);color:var(--dsw-alias-label-secondary); }
.qcu-market .qcu-meta dt { margin-top:12px;font-weight:600; }
.qcu-market .qcu-meta dd { margin:4px 0;line-height:1.6; }
.qcu-market .qcu-foot { margin:24px 0 0;font-size:calc(var(--qcu-market-font) * 12 / 14);color:var(--dsw-alias-label-secondary); }
.qcu-market .qcu-error { padding:16px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:4px;color:var(--dsw-alias-state-error-primary); }
.qcu-market .qcu-icon-tile[data-scene="data"],.qcu-market .qcu-icon-tile[data-scene="integrity"] { color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-state-success-secondary); }
.qcu-market .qcu-icon-tile[data-scene="lesson"],.qcu-market .qcu-icon-tile[data-scene="reading"] { color:var(--dsw-alias-state-warn-label);background:var(--dsw-alias-state-warn-secondary); }

.qcu-market .qcu-market-workspace { display:grid;grid-template-columns:156px minmax(0,1fr);gap:24px;align-items:start; }
.qcu-market .qcu-market-results { min-width:0; }
.qcu-market .qcu-scenes h2 { margin:0 0 12px;padding:0 10px;font-size:calc(var(--qcu-market-font) * 12 / 14);font-weight:500;color:var(--dsw-alias-label-secondary); }
.qcu-market .qcu-scene-filter { display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:10px;margin:4px 0;border:0;border-radius:7px;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit;font-size:calc(var(--qcu-market-font) * 12 / 14);min-height:40px; }
.qcu-market .qcu-scene-filter[aria-pressed="true"] { background:var(--dsw-alias-button-ghost-active-fill);color:var(--dsw-alias-brand-text);font-weight:600; }
.qcu-market .qcu-scene-filter:hover { background:var(--dsw-alias-interactive-bg-hover); }
.qcu-market .qcu-card-version { font-size:calc(var(--qcu-market-font) * 11 / 14);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums; }
.qcu-market .qcu-card-footer .qcu-status { flex-basis:100%; }
.qcu-market .qcu-versions h2 { font-size:calc(var(--qcu-market-font) * 16 / 14); }
.qcu-market .qcu-history { border:1px solid var(--dsw-alias-border-l3);border-radius:8px;padding:4px 12px;background:var(--dsw-alias-bg-layer-1); }
.qcu-market .qcu-version-row { display:grid;justify-items:start;gap:6px;padding:14px 0;border-top:1px solid var(--dsw-alias-border-l2);min-width:0; }
.qcu-market .qcu-version-row h3 { margin:0;font-size:calc(var(--qcu-market-font) * 13 / 14);font-weight:600; }
.qcu-market .qcu-version-row code { display:block;max-width:100%;font-size:calc(var(--qcu-market-font) * 11 / 14);line-height:1.8;overflow-wrap:anywhere; }
.qcu-market .qcu-version-row .qcu-hint { margin:0; }
.qcu-market .qcu-update-heading { display:flex;justify-content:space-between;align-items:start;gap:16px;flex-wrap:wrap; }
.qcu-market .qcu-update-list { margin:18px 0;border-top:1px solid var(--dsw-alias-border-l3); }
.qcu-market .qcu-update-item { display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 0;border-bottom:1px solid var(--dsw-alias-border-l3); }
.qcu-market .qcu-update-item h3 { margin:0;font-size:var(--qcu-market-font);font-weight:600; }
.qcu-market .qcu-update-item .qcu-hint { margin:4px 0; }
.qcu-market .qcu-updates .qcu-review { margin:20px 0; }
@media(max-width:860px) {
 .qcu-market .qcu-market-workspace { grid-template-columns:minmax(0,1fr);gap:16px; }
 .qcu-market .qcu-scenes { display:flex;flex-wrap:wrap;gap:6px; }
 .qcu-market .qcu-scenes h2 { flex-basis:100%;padding:0;margin:0 0 4px; }
 .qcu-market .qcu-scene-filter { width:auto;gap:12px;margin:0;padding:8px 10px;border:1px solid var(--dsw-alias-border-l3);min-height:40px; }
}
@media(max-width:600px) { .qcu-market .qcu-grid { grid-template-columns:minmax(0,1fr); } }

@media(max-width:560px) {
 .qcu-market { padding-top:16px; }
 .qcu-market .qcu-app-header { flex-wrap:wrap; }
 .qcu-market .qcu-wordmark { font-size:calc(var(--qcu-market-font) * 16 / 14); }
 .qcu-market .qcu-page-nav { display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px; }
 .qcu-market .qcu-page-nav .qcu-control { justify-content:center;padding-inline:6px;white-space:normal;overflow-wrap:anywhere; }
 .qcu-market .qcu-control,.qcu-market .qcu-tabs button { min-height:44px; }
 .qcu-market summary { min-height:44px;padding:11px 0; }
 .qcu-market .qcu-onboarding { flex-wrap:wrap;padding:12px;gap:10px; }
 .qcu-market .qcu-toolbar { gap:12px; }
 .qcu-market .qcu-search { flex-basis:100%; }
 .qcu-market .qcu-search input { min-height:44px; }
 .qcu-market .qcu-progress { grid-template-columns:1fr;gap:0;margin-bottom:20px; }
 .qcu-market .qcu-progress li { flex-direction:row;align-items:baseline;gap:12px;padding:6px 10px;border-top:0;border-left:2px solid var(--dsw-alias-border-l3); }
 .qcu-market .qcu-guide-body { padding-top:16px; }
 .qcu-market .qcu-detail-head>div { min-width:0; }
.qcu-market .qcu-detail-head h1 { font-size:calc(var(--qcu-market-font) * 22 / 14);line-height:calc(var(--qcu-market-font) * 30 / 14); }
 .qcu-market .qcu-actions,.qcu-market .qcu-review { padding:14px; }
 .qcu-market .qcu-facts > div { grid-template-columns:72px minmax(0,1fr);gap:12px; }
 .qcu-market .qcu-head { flex-direction:column; }
}
@media(prefers-reduced-motion:reduce) { .qcu-market * { animation:none !important;transition:none !important;scroll-behavior:auto !important; } }
`
