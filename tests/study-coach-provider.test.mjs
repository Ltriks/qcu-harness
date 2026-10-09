import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { Context } from '@deepseek-ai/cordis'
import Skills from '@deepseek-ai/dsh-skill'
import { createSkillProvider, expectedSkillSha256, skillName } from '../hub/plugins/qcu-study-coach/provider.js'
import { sha256, validateCatalog, verifyDirectory } from '../hub/release/catalog.mjs'
const skillUrl = new URL('../skills/chengyuan-study-coach/SKILL.md', import.meta.url)

test('runtime rejects changed canonical content before registration', async () => {
 const bytes=await readFile(skillUrl);assert.equal(sha256(bytes),expectedSkillSha256)
 assert.throws(()=>createSkillProvider(bytes.toString()+'\nchanged'),/source mismatch/)
 assert.throws(()=>createSkillProvider(null),/source mismatch/)
})
test('disabled config registers nothing, explicit activation remains mandatory', async () => {
 const content=await readFile(skillUrl,'utf8');const apply=createSkillProvider(content);const ctx=new Context()
 try {await ctx.plugin(Skills).await();await ctx.plugin({name:'qcu-study-coach',inject:['skills'],apply},{enabled:false}).await();assert.deepEqual(await ctx.skills.list(),[]);assert.throws(()=>apply(ctx,{}),/explicit activation/)}finally{await ctx.fiber.dispose()}
})
test('real Cordis Skill content is byte-identical and disposal/recreation removes old registration', async () => {
 const content=await readFile(skillUrl,'utf8')
 for(let rebuild=0;rebuild<2;rebuild++){
  const ctx=new Context();try{await ctx.plugin(Skills).await();const fiber=ctx.plugin({name:'qcu-study-coach',inject:['skills'],apply:createSkillProvider(content)},{enabled:true});await fiber.await();assert.deepEqual((await ctx.skills.list()).map(s=>s.name),[skillName]);assert.equal((await ctx.skills.get(skillName)).content,content);await fiber.dispose();assert.deepEqual(await ctx.skills.list(),[])}finally{await ctx.fiber.dispose()}
 }
})
test('actual packed module loads from extracted eight-file artifact without dependency installation', async t => {
 const root=await mkdtemp(join(tmpdir(),'qcu-study-coach-'));t.after(()=>rm(root,{recursive:true,force:true}));const out=join(root,'candidate')
 const result=JSON.parse(execFileSync('/usr/bin/python3',['-B',new URL('../scripts/stage-study-coach-pilot.py',import.meta.url).pathname,'--out',out],{encoding:'utf8'}));const c=JSON.parse(await readFile(join(out,'catalog.json')));validateCatalog(c);assert.equal((await verifyDirectory(out)).catalogSha256,result.catalogSha256)
 const extracted=join(root,'extracted');execFileSync('/usr/bin/python3',['-B','-c',"import sys,tarfile; from pathlib import Path; a=tarfile.open(sys.argv[1],'r:gz'); m=a.getmembers(); assert len(m)==8 and all(i.isfile() and i.name.startswith('package/') and '..' not in Path(i.name).parts for i in m); a.extractall(sys.argv[2])",join(out,'plugins',result.file),extracted]);
 const p=JSON.parse(await readFile(join(extracted,'package/package.json')));assert.equal(p.version,'0.1.0-pilot.1');assert.equal(p.scripts,undefined);assert.equal(p.dependencies,undefined);const patch=JSON.parse(await readFile(join(extracted,'package/cordis.patch.yml')));assert.equal(patch[0].insert[0].disabled,true)
 const provider=await import(pathToFileURL(join(extracted,'package/index.js')));const ctx=new Context();try{await ctx.plugin(Skills).await();await ctx.plugin(provider,{enabled:true}).await();assert.equal((await ctx.skills.get(skillName)).content,await readFile(skillUrl,'utf8'))}finally{await ctx.fiber.dispose()}
})
