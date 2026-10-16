# QCU MARKET UI REFRESH POLISH

Parent live Chrome review of actual shared preview at 390px found two visual refinements. Apply after reading prior QCU-MARKET-UI-REFRESH.md, protected semantics unchanged.

1. Mobile main navigation currently renders a very roomy 2-by-2 grid. Four short 4-character Chinese labels fit one row at 360/390 with 44px height and small horizontal padding. Use a compact four-column row at these supported narrow widths, keep all words visible, no horizontal overflow, clear active state and >=12px separation from app exit. Avoid reducing readability or touch height. Verify all labels at 360/390.
2. Programmatic page-heading focus is shown as a long green rectangular outline around the full H1 on every navigation. Preserve heading focus (tabIndex -1) and focus recovery but remove decorative outline for these non-interactive programmatic headings. Keep normal visible focus rings on keyboard-interactive controls.
3. Guide 下一步 and 完成引导 should be primary accent actions so a first-time teacher can distinguish next from previous/skip. Do not change their labels, disabled state, callbacks, sequence or semantics; reuse existing primary control class.

Rebuild client and shared preview to SAME artifact candidate directory (not immutable package), rerun relevant source/guide and real browser/layout suites. Parent is independently running initial real browser suites with normal local network approval; errors/metrics will be supplied on resume if any. Record before/after logs separately, screenshot latest homepage and guide for light/dark desktop and narrow. Do not deploy, modify protected runtime/flow, or create TGZ. Update docs with final actual results and keep failed first attempts honest.
