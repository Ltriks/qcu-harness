# R1b parent review findings

Do not change scope or existing confirmation semantics. Address before final candidate delivery.

## 1. DOCX table context needs same-row value sources

Reproduced with self-authored /private/tmp/qcu-reading-r1b/parent-cases/自编会计章节与表格.docx. Real parser correctly extracts table1 row2 cell1 `盈亏平衡销量` and cell2 `250件`. `evidenceFor({...parsed,format:'docx'}, '盈亏平衡销量是多少？')` currently selects ONLY the label cell, never the value. Thus the common teacher question is unanswerable from the confirmed sources although the value is in the same source row. Proof: TABLE-CONTEXT-REPRO.json alongside this file.

Please add bounded deterministic table context retrieval: a matched DOCX cell should bring relevant same-row cells into the confirmation, prioritizing the label/value context over unrelated matches and headers. Keep each actual source cell locator and exact text; maintain max source count/snippet limits; no hidden data may be sent. Multiple matched cells/rows should deduplicate. Plain TXT/MD/PDF retrieval behavior should stay unchanged. Test the real DOCX fixture label/value question through parser/evidence and actual browser confirmation, assert `250件` is visibly included, then exact prompt/exports preserve real cell positions. No model knowledge should be needed to supply this missing value.

## 2. Tracked move text versus visible-view warning

Current parser warning says `修订只提取当前可见的插入正文，删除内容未导入。` but hidden handling includes `w:del` and not `w:moveFrom`. Moved-from old text may be included along with moved-to new text. Make behavior and claim agree: preferably treat moveFrom as deleted and preserve moveTo/ins with the revision warning. Test a self-authored moved-from/moved-to fixture so stale moved text does not enter the advertised current-text view.

## Parent checks so far (provisional)

Standalone PDF.js6.3.289 + genuine DOMMatrix3.1.2 text extraction succeeds from an isolated /private/tmp directory where @napi-rs/canvas is not resolvable; zero fetch calls. PDF.js6 cleanup uses loadingTask.destroy(), not documentProxy.destroy(). Current implementation correctly uses task.destroy().

Actual parser processes self-authored two-page accounting PDF with correct page2 location and Chinese DOCX with heading/table positions plus external-link/formula omission notices. Workers return to0. PARENT-PARSER-EARLY-CHECK.json is provisional until final code is frozen.


## 3. Keep extraction notices compact without hiding omissions

Current view renders every extractionNotices entry as a separate always-visible paragraph, most in error color. A normal DOCX with the common header/footnote/comment parts plus an image/equation can put 6–7 warning paragraphs before any source text, especially on360px. This conflicts with the accepted compact teacher-tool UI. Please keep a short visible summary of incomplete extraction (and visible PDF no-text page markers), with full typed/page-specific explanation in an accessible expandable section. Do not remove warnings from data/confirmation/export, and do not hide that material is incomplete. Keep the original material as the main content. Add a narrow-view check with multiple omission types, verify the summary and expandable details are present; preserve the existing format/source and model consent checks.
