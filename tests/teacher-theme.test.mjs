import test from 'node:test';
import assert from 'node:assert/strict';
import {teachingTasks,recentTasks,openTeachingDraft} from '../tools/teacher-branding/src/tasks.mjs';
import {themeTokens} from '../tools/teacher-branding/src/theme.mjs';

test('recent tasks exclude blank and archived sessions and keep newest first',()=>{
 const rows=[{id:'old',updatedAt:2},{id:'blank',blank:true,updatedAt:100},{id:'archived',updatedAt:100},{id:'new',updatedAt:5}];
 assert.deepEqual(recentTasks({ids:rows.map(s=>s.id),byId:Object.fromEntries(rows.map(s=>[s.id,s]))},{archivedSessionIds:['archived']}).map(s=>s.sessionId),['new','old']);
});
test('opening a task uses a fresh retained session, sets draft once, never sends',async()=>{
 const calls=[],binding={ctx:{sessionId:'new'}};
 const ctx={workspaces:{list:{getSnapshot:()=>({items:[{workspaceId:'w'}]})}},sessions:{create:async options=>{calls.push(['create',options]);return'new'},retain:(id,options)=>{calls.push(['retain',id,options]);return{binding,release:()=>calls.push(['release'])}}},conversation:{input:{for:scope=>{assert.equal(scope,binding.ctx);return{snapshot:{draft:'',attachmentIds:[]},setDraft:text=>calls.push(['draft',text])}}}},uiWorkspace:{openSession:id=>calls.push(['open',id])}};
 assert.equal(await openTeachingDraft(ctx,'w','教师要求'),'new');
 assert.deepEqual(calls.map(x=>x[0]),['create','retain','draft','open','release']);
 assert.deepEqual(calls[0][1],{workspaceId:'w'});
});
test('existing draft and attachments are preserved and temporary retention released',async()=>{
 let changed=false,released=false;
 const ctx={workspaces:{list:{getSnapshot:()=>({items:[{workspaceId:'w'}]})}},sessions:{create:async()=> 'occupied',retain:()=>({binding:{ctx:{}},release:()=>{released=true}})},conversation:{input:{for:()=>({snapshot:{draft:'already edited',attachmentIds:['a']},setDraft:()=>{changed=true}})}},uiWorkspace:{openSession:()=>{changed=true}}};
 await assert.rejects(openTeachingDraft(ctx,'w','new'),/已有草稿/);assert.equal(changed,false);assert.equal(released,true);
});
test('stale workspace fails before creating a session',async()=>{
 const ctx={workspaces:{list:{getSnapshot:()=>({items:[]})}},sessions:{create:()=>assert.fail('must not create')}};
 await assert.rejects(openTeachingDraft(ctx,'removed','要求'),/已变化/);
});
test('teacher capabilities are exactly the seven frozen skills',()=>{
 assert.deepEqual(teachingTasks.map(t=>t.id).sort(),['qcu-study-coach','qcu-lesson-planning','qcu-tiered-practice','qcu-note-organizer','qcu-reading-outline','qcu-integrity-guard','qcu-team-briefing'].sort());
 assert.equal(new Set(teachingTasks.map(t=>t.id)).size,7);
});
function luminance(hex){const [r,g,b]=hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;}
const contrast=(a,b)=>{const x=luminance(a.slice(1)),y=luminance(b.slice(1));return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
test('light and dark palettes meet readable body, muted, selected and primary-button contrast',()=>{
 for(const mode of [0,1]){
  for(const background of ['--qcu-canvas','--qcu-paper','--qcu-selected'])for(const foreground of ['--qcu-ink','--qcu-muted','--qcu-blue'])assert.ok(contrast(themeTokens[background][mode],themeTokens[foreground][mode])>=4.5,background+' / '+foreground+' / '+mode);
  assert.ok(contrast('#FFFFFF',themeTokens['--qcu-button'][mode])>=4.5);
  assert.ok(contrast(themeTokens['--qcu-error-bg'][mode],themeTokens['--qcu-error-ink'][mode])>=4.5);
 }
});
