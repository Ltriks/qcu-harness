export const themeTokens = {
 '--dsw-alias-bg-base':['#FFFFFF','#17212E'],
 '--dsw-alias-bg-layer-1':['#FFFFFF','#1D2A3A'],
 '--dsw-alias-bg-layer-2':['#FFFFFF','#233247'],
 '--dsw-alias-bg-layer-3':['#F7FAFD','#293B50'],
 '--dsw-alias-bg-module-platform':['#F7FAFD','#1D2A3A'],
 '--dsw-specific-sidebar-fill':['#F0F5FA','#14202D'],
 '--dsw-specific-input-major':['#FFFFFF','#1D2A3A'],
 '--dsw-alias-label-primary':['#17324D','#E5EFF9'],
 '--dsw-alias-label-primary-dimmed':['#304E6A','#D0DFED'],
 '--dsw-alias-label-secondary':['#48617A','#B8CBDE'],
 '--dsw-alias-label-tertiary':['#566C82','#A8BED2'],
 '--dsw-alias-label-caption':['#617589','#9FB5CA'],
 '--dsw-alias-border-l1':['#E5EDF5','#2B4055'],
 '--dsw-alias-border-l2':['#D9E5EE','#354C63'],
 '--dsw-alias-border-l3':['#CBDCE9','#405A73'],
 '--dsw-alias-border-l4':['#A6BED3','#68839D'],
 '--dsw-alias-state-business-primary':['#174F91','#93C4FF'],
 '--dsw-alias-brand-primary':['#174F91','#93C4FF'],
 '--dsw-alias-brand-text':['#174F91','#B6D8FF'],
 '--dsw-alias-button-primary-fill':['#174F91','#285E9C'],
 '--dsw-alias-button-primary-hover':['#103F78','#3473B8'],
 '--dsw-alias-button-info-fill':['#174F91','#285E9C'],
 '--dsw-alias-button-info-hover':['#103F78','#3473B8'],
 '--dsw-alias-interactive-bg-hover':['#E9F2F9','#293F57'],
 '--dsw-alias-interactive-bg-hover-solid':['#E1ECF6','#314D68'],
 '--qcu-canvas':['#F7FAFD','#111B27'],
 '--qcu-paper':['#FFFFFF','#1D2A3A'],
 '--qcu-selected':['#E9F2F9','#263F5B'],
 '--qcu-blue':['#174F91','#ABD1FF'],
 '--qcu-button':['#174F91','#285E9C'],
 '--qcu-line':['#D9E5EE','#354C63'],
 '--qcu-ink':['#17324D','#E5EFF9'],
 '--qcu-muted':['#48617A','#B8CBDE'],
 '--qcu-error-bg':['#FFF0EE','#462B2D'],
 '--qcu-error-ink':['#962E24','#FFC0B8'],
 '--dsw-font-family':['"PingFang SC","Microsoft YaHei",system-ui,sans-serif','"PingFang SC","Microsoft YaHei",system-ui,sans-serif']
};
export const pairedTokens=Object.fromEntries(Object.entries(themeTokens).map(([name,[light,dark]])=>[name,{light,dark}]));

export const teacherStyles = `
body[data-qcu-teacher]{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;--qcu-font:18px;--qcu-small:15px}
body[data-qcu-teacher][data-qcu-large]{--qcu-font:20px;--qcu-small:17px}
.qcu-teacher{box-sizing:border-box;color:var(--qcu-ink);font:var(--qcu-font)/1.7 "PingFang SC","Microsoft YaHei",system-ui,sans-serif}
.qcu-teacher *{box-sizing:border-box}.qcu-teacher button,.qcu-teacher select,.qcu-teacher textarea{font:inherit}
.qcu-teacher button{cursor:pointer}.qcu-teacher button:disabled{cursor:default;opacity:.55}
.qcu-teacher :focus-visible{outline:3px solid var(--qcu-blue);outline-offset:3px}
.qcu-home{height:100%;width:100%;min-height:0;min-width:0;flex:1;overflow:auto;background:var(--qcu-canvas);container-type:inline-size}
.qcu-home-inner{max-width:1060px;margin:auto;padding:46px 52px 48px}
html[data-platform=darwin] .qcu-home-inner{padding-top:58px}
.qcu-home-top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:28px}
.qcu-home h1{font-size:30px;line-height:1.4;letter-spacing:.02em;margin:0;font-weight:650}
.qcu-home h2{font-size:21px;line-height:1.5;margin:0 0 12px;font-weight:600}
.qcu-home :is(h1,h2,p){overflow-wrap:anywhere}.qcu-home section,.qcu-home header,.qcu-home aside{min-width:0}
.qcu-home p{margin:8px 0 16px;max-width:42em}.qcu-muted{color:var(--qcu-muted);font-size:var(--qcu-small)}
.qcu-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.qcu-button{min-height:44px;border:1px solid var(--qcu-line);border-radius:8px;padding:8px 16px;background:var(--qcu-paper);color:var(--qcu-ink)}
.qcu-button:hover:not(:disabled){background:var(--qcu-selected);border-color:var(--qcu-blue)}
.qcu-button.primary{background:var(--qcu-button);border-color:var(--qcu-button);color:white}
.qcu-button.quiet{border-color:transparent;background:transparent;color:var(--qcu-blue)}
.qcu-task-sheet{background:var(--qcu-paper);border:1px solid var(--qcu-line);border-top:4px solid var(--qcu-blue);border-radius:4px 4px 12px 12px;padding:28px 30px}
.qcu-task-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:18px 0 24px}
.qcu-task-tabs button{min-height:48px;padding:8px 17px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--qcu-muted)}
.qcu-task-tabs button[aria-pressed=true]{background:var(--qcu-selected);color:var(--qcu-blue);border-color:var(--qcu-line);font-weight:600}
.qcu-task-tabs button:hover{background:var(--qcu-selected)}
.qcu-field{display:flex;flex-direction:column;gap:8px;margin:20px 0}.qcu-field>span{font-size:var(--qcu-small);font-weight:600}
.qcu-field textarea,.qcu-field select{width:100%;border:1px solid var(--qcu-line);border-radius:7px;background:var(--qcu-canvas);color:var(--qcu-ink);padding:12px 14px;min-height:48px}
.qcu-field textarea{resize:vertical;min-height:220px;line-height:1.7}.qcu-field select{max-width:100%}
.qcu-task-bottom{display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap}.qcu-task-bottom p{margin:0;flex:1;min-width:200px}
.qcu-lower{display:grid;grid-template-columns:minmax(0,1fr) 265px;gap:34px;margin-top:32px}.qcu-recent{padding:0;list-style:none;margin:0}
.qcu-recent li{border-bottom:1px solid var(--qcu-line)}.qcu-recent button{display:block;text-align:left;width:100%;padding:12px 0;min-height:54px;background:transparent;border:0;color:var(--qcu-ink);overflow-wrap:anywhere}
.qcu-recent button:hover{color:var(--qcu-blue)}.qcu-empty{border:1px dashed var(--qcu-line);padding:20px;border-radius:8px}
.qcu-course-link{padding:0 0 22px;border-bottom:1px solid var(--qcu-line);margin-bottom:22px}.qcu-home details{margin-top:22px}.qcu-home summary{cursor:pointer;color:var(--qcu-blue);min-height:44px}
.qcu-tool-list{list-style:none;padding:0;margin:0}.qcu-tool-list li{padding:18px 0;border-bottom:1px solid var(--qcu-line)}.qcu-tool-list strong{font-size:20px}.qcu-tool-list p{margin:4px 0 12px}
.qcu-notice{padding:12px 16px;background:var(--qcu-selected);border-left:3px solid var(--qcu-blue);margin:16px 0;border-radius:0 7px 7px 0}
.qcu-notice[role=alert]{color:var(--qcu-error-ink);background:var(--qcu-error-bg);border-color:currentColor}
.qcu-side{height:100%;min-width:0;display:flex;flex-direction:column;overflow-x:hidden;overflow-y:auto;background:var(--dsw-specific-sidebar-fill);border-right:1px solid var(--qcu-line);padding:46px 16px 14px;font-size:16px}
html:not([data-platform=darwin]) .qcu-side{padding-top:16px}.qcu-side-brand{display:flex;gap:10px;align-items:center;padding:7px 8px 22px;flex-wrap:wrap}.qcu-side-brand strong{font-size:21px;font-weight:650;letter-spacing:.03em}.qcu-side-brand small{display:block;color:var(--qcu-muted);font-size:12px;letter-spacing:.12em}
body[data-qcu-large] .qcu-side{font-size:18px}html[data-windows-titlebar] .qcu-side{padding-top:calc(var(--dsh-windows-titlebar-height,40px) + 12px)}
.qcu-side-nav{display:flex;flex-direction:column;flex:none;gap:7px}.qcu-side-nav button{display:flex;align-items:center;gap:12px;text-align:left;min-height:48px;border:0;border-radius:7px;padding:10px 12px;color:var(--qcu-ink);background:transparent;white-space:nowrap}.qcu-side-nav button[aria-current=page]{background:var(--qcu-paper);box-shadow:inset 3px 0 var(--qcu-blue);color:var(--qcu-blue);font-weight:600}.qcu-side-nav button:hover{background:var(--qcu-selected)}
/* Short windows scroll the sidebar; native workspace controls keep a usable viewport. */
.qcu-side-work{flex:1 0 144px;min-height:144px;overflow:auto;margin-top:24px}.qcu-side-work h2{font-size:13px;color:var(--qcu-muted);font-weight:500;padding:0 10px;margin:0 0 8px}.qcu-side-foot{padding-top:12px;border-top:1px solid var(--qcu-line)}.qcu-side-foot details>summary{min-height:44px;cursor:pointer;color:var(--qcu-muted);font-size:14px}.qcu-side-foot .qcu-button{font-size:14px;width:100%;text-align:left}
.qcu-side-foot,.qcu-side-brand,.qcu-side>.qcu-button{flex:none}.qcu-side-foot details .qcu-button{white-space:normal}
.qcu-footer-row{box-sizing:border-box;display:flex;align-items:center;gap:12px;width:100%;min-height:44px;margin:0;padding:8px 12px;border:0;border-radius:6px;background:transparent;color:var(--qcu-ink);font:16px/24px var(--dsw-font-family);text-align:left;cursor:pointer}
.qcu-footer-row>svg{flex:none}.qcu-footer-row:hover{background:var(--qcu-selected)}
.qcu-side-foot .qcu-maintenance>summary{font:16px/24px var(--dsw-font-family);color:var(--qcu-ink);list-style:none}
.qcu-maintenance>summary::-webkit-details-marker{display:none}.qcu-maintenance>summary>svg{transform:rotate(180deg)}.qcu-maintenance[open]>summary>svg{transform:rotate(-90deg)}
.qcu-maintenance-items .qcu-footer-row{padding-left:44px;font-size:15px}
.qcu-footer-settings [data-slot="sidebar.settings"]>div:first-child{display:flex;flex-direction:column;align-items:stretch;gap:4px;width:100%;margin:0}
.qcu-footer-settings [data-slot="sidebar.settings"]>div:first-child>button:not(.qcu-footer-row){align-self:flex-start;margin:0 12px 4px;min-height:32px;font-size:14px}
/* Keep native workspace actions, picker, search and menus; only label and reflow
   their semantic controls in the frozen UI. No generated class names. */
.qcu-native-workspaces{--dsh-sidebar-inline-padding:0px}
.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child{display:flex;flex-wrap:wrap;height:auto;min-height:44px;padding:0;margin:0 0 10px;overflow:visible;gap:6px;justify-content:flex-start}
.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child>span{flex-basis:100%;max-width:100%;font-size:14px;padding:4px 12px}
.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child>div{max-width:100%;min-width:0;margin:0;padding:0}
.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child>div:has(button[aria-expanded]){flex-basis:100%;width:100%}
.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child>div:has(button[aria-expanded])>div{height:44px;width:100%;margin:0}
.qcu-native-workspaces button:is([aria-label="搜索会话"],[aria-label="Search sessions"]):not([aria-expanded=true]){width:100%;height:44px;justify-content:flex-start;gap:12px;padding:8px 12px;font:15px/24px var(--dsw-font-family)}
.qcu-native-workspaces button:is([aria-label="搜索会话"],[aria-label="Search sessions"]):not([aria-expanded=true])::after{content:attr(aria-label)}
.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child>div:has(>button[aria-label="添加工作区"]),.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child>div:has(>button[aria-label="Add workspace"]){flex-basis:100%;max-width:100%;width:100%;height:44px}
.qcu-native-workspaces button:is([aria-label="添加工作区"],[aria-label="Add workspace"]){order:-1;flex:1;width:auto;height:44px;justify-content:flex-start;gap:12px;padding:8px 12px;font:15px/24px var(--dsw-font-family)}
.qcu-native-workspaces button:is([aria-label="添加工作区"],[aria-label="Add workspace"])::after{content:attr(aria-label)}
.qcu-native-workspaces button:is([aria-label="视图选项"],[aria-label="View options"]){width:36px;height:44px}
.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child:has(button:is([aria-label="搜索会话"],[aria-label="Search sessions"])[aria-expanded=true])>div:has(>button[aria-label="添加工作区"]),.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child:has(button:is([aria-label="搜索会话"],[aria-label="Search sessions"])[aria-expanded=true])>div:has(>button[aria-label="Add workspace"]){display:none}
.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child:has(button:is([aria-label="搜索会话"],[aria-label="Search sessions"])[aria-expanded=true])>span{display:none}
.qcu-header-nav{display:flex;align-items:center;gap:6px;font-size:14px;-webkit-app-region:no-drag}.qcu-header-nav .qcu-button{min-height:36px;padding:4px 10px}.qcu-windows-recovery{display:none}
html[data-platform=darwin] body[data-qcu-teacher] [data-sidebar-collapsed]{--dsh-frame-leading-clearance:240px}
html[data-windows-titlebar] .qcu-windows-recovery{display:block;position:fixed;top:2px;left:8px;z-index:30;-webkit-app-region:no-drag}
html[data-windows-titlebar]:has(body[data-qcu-teacher] [data-sidebar-collapsed]){--dsh-windows-menu-start:160px}
.qcu-side.collapsed{padding:44px 5px 12px;align-items:center}.qcu-side.collapsed .qcu-side-brand{padding:0 0 12px}.qcu-side.collapsed .qcu-side-nav{align-self:stretch;min-width:0}.qcu-side.collapsed .qcu-side-nav button{padding:10px 0;justify-content:center}.qcu-side.collapsed .qcu-side-work{display:none}.qcu-side.collapsed .qcu-side-foot{margin-top:auto;width:100%}
.qcu-side.collapsed>.qcu-button{width:100%;padding-inline:0}.qcu-side.collapsed .qcu-footer-row{padding:8px 0;justify-content:center;gap:0}
/* Keep the settings name accessible in the icon rail, including with a scrollbar. */
.qcu-side.collapsed .qcu-footer-row>span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
/* Semantic host anchors only; never target generated/minified class names. */
body[data-qcu-teacher] [data-composer-card]{border:1px solid var(--qcu-line);box-shadow:none;border-radius:12px}
body[data-qcu-teacher] [data-composer-input]{min-height:70px;padding:12px 18px}
body[data-qcu-teacher] [data-composer-card] button{min-width:44px;min-height:44px}
body[data-qcu-teacher] .qcu-course{--bg:var(--qcu-canvas);--card:var(--qcu-paper);--soft:var(--qcu-canvas);--line:var(--qcu-line);--ink:var(--qcu-ink);--body:var(--qcu-muted);--accent:var(--qcu-blue);--mint:var(--qcu-selected);font-size:var(--qcu-font);font-family:var(--dsw-font-family)}
body[data-qcu-teacher] .qcu-course .logo{background:var(--qcu-button)}
body[data-qcu-teacher] .qcu-course .primary{background:var(--qcu-button);border-color:var(--qcu-button)}
body[data-qcu-teacher] .qcu-course .btn{min-height:44px}
body[data-qcu-teacher] .qcu-course :is(.muted,.field,.chip,.component strong,.task-button,.footer,code){font-size:var(--qcu-small)}
body[data-qcu-teacher] .qcu-course input[type=checkbox]{accent-color:var(--qcu-blue);width:20px;height:20px}
body[data-qcu-teacher] .qcu-course :focus-visible{outline-color:var(--qcu-blue)}
body[data-qcu-teacher] .qcu-course .step small{font-size:12px;letter-spacing:0}
body[data-qcu-teacher] .qcu-course .card{box-shadow:none}
@container(max-width:800px){.qcu-home-inner{padding:32px 24px}.qcu-home-top{align-items:flex-start;flex-wrap:wrap}.qcu-lower{grid-template-columns:1fr}.qcu-task-sheet{padding:22px}.qcu-home h1{font-size:26px}}
@container(max-width:480px){.qcu-home-inner{padding:28px 16px}.qcu-task-sheet{padding:18px 14px}.qcu-task-tabs{gap:2px}.qcu-task-tabs button{padding:8px 10px}.qcu-task-bottom>.qcu-button{width:100%}}
@media(prefers-reduced-motion:reduce){.qcu-teacher *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`;
