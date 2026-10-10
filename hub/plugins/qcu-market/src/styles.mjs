// Scoped to our slot; official rc.2 semantic tokens inherit the user's theme.
export const marketStyles = `
.qcu-market { box-sizing:border-box;height:100%;overflow:auto;padding:28px clamp(20px,4vw,48px) 48px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font:inherit; }
.qcu-market * { box-sizing:border-box; }
.qcu-market .qcu-content { max-width:1280px;margin:0 auto; }
.qcu-market .qcu-head { display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin:24px 0; }
.qcu-market .qcu-wordmark { display:flex;align-items:center;gap:12px; }
.qcu-market h1 { margin:0;font-size:24px;line-height:32px;font-weight:600; }
.qcu-market h2 { margin:0;font-size:16px;line-height:24px;font-weight:600; }
.qcu-market p { line-height:1.6; }
.qcu-market .qcu-intro { margin:6px 0 0;color:var(--dsw-alias-label-secondary);font-size:14px; }
.qcu-market .qcu-note { padding:14px 16px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);font-size:13px;color:var(--dsw-alias-label-secondary); }
.qcu-market .qcu-filters { display:flex;flex-wrap:wrap;gap:8px;margin:24px 0 12px; }
.qcu-market button,.qcu-market summary { font:inherit; }
.qcu-market .qcu-control { display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:36px;padding:7px 12px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;font-size:13px;line-height:20px; }
.qcu-market .qcu-control:hover { background:var(--dsw-alias-interactive-bg-hover); }
.qcu-market .qcu-control:active { background:var(--dsw-alias-interactive-bg-active); }
.qcu-market .qcu-control[aria-pressed="true"] { background:var(--dsw-alias-button-ghost-active-fill);border-color:var(--dsw-alias-button-ghost-active-border);color:var(--dsw-alias-brand-text); }
.qcu-market :is(button,summary,pre,input):focus-visible { outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px; }
.qcu-market .qcu-count { color:var(--dsw-alias-label-secondary);font-size:13px;margin:0 0 20px; }
.qcu-market .qcu-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:16px;align-items:start; }
.qcu-market .qcu-card { min-width:0;padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:16px;background:var(--dsw-alias-bg-layer-1); }
.qcu-market .qcu-card-top { display:flex;align-items:center;gap:12px;margin-bottom:12px; }
.qcu-market .qcu-icon-tile { display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;flex:none;border-radius:12px;color:var(--dsw-alias-brand-text);background:var(--dsw-alias-button-ghost-active-fill); }
.qcu-market .qcu-badge { padding:4px 8px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px; }
.qcu-market .qcu-status { display:block;margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px; }
.qcu-market .qcu-summary { margin:0 0 18px;font-size:14px; }
.qcu-market details { margin-top:12px; }
.qcu-market summary { cursor:pointer;line-height:22px; }
.qcu-market .qcu-guide > summary { padding:9px 12px;border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);font-size:14px;font-weight:500; }
.qcu-market .qcu-guide[data-official="true"] > summary { color:var(--dsw-alias-label-primary-foreground);background:var(--dsw-alias-button-primary-fill); }
.qcu-market .qcu-guide[data-official="true"] > summary:hover { background:var(--dsw-alias-button-primary-hover); }
.qcu-market .qcu-guide > div { padding:4px 0; }
.qcu-market .qcu-guide p { font-size:13px;color:var(--dsw-alias-label-secondary); }
.qcu-market pre { white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;padding:12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);font:inherit;font-size:13px;line-height:1.6; }
.qcu-market .qcu-meta { border-top:1px solid var(--dsw-alias-border-l2);padding-top:12px;font-size:12px;color:var(--dsw-alias-label-secondary); }
.qcu-market .qcu-meta dt { margin-top:12px;font-weight:600; }
.qcu-market .qcu-meta dd { margin:4px 0;overflow-wrap:anywhere;line-height:1.6; }
.qcu-market .qcu-foot { margin:24px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary); }
.qcu-market .qcu-error { padding:16px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:12px;color:var(--dsw-alias-state-error-primary); }
 .qcu-market .qcu-search { display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:24px;font-size:13px; }
.qcu-market .qcu-search input { min-width:0;flex:1 1 220px;max-width:440px;height:38px;padding:8px 12px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);font:inherit; }
.qcu-market .qcu-search input::placeholder { color:var(--dsw-alias-label-secondary); }
.qcu-market .qcu-card-heading { min-width:0; }
.qcu-market .qcu-icon-tile[data-scene="data"],.qcu-market .qcu-icon-tile[data-scene="integrity"] { color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-state-success-secondary); }
.qcu-market .qcu-icon-tile[data-scene="lesson"],.qcu-market .qcu-icon-tile[data-scene="reading"] { color:var(--dsw-alias-state-warn-label);background:var(--dsw-alias-state-warn-secondary); }
@media (max-width:560px) { .qcu-market .qcu-head { flex-direction:column; } .qcu-market .qcu-card { padding:16px; } }
`
