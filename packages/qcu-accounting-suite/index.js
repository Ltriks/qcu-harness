import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {BUNDLED_SKILL_RANK} from '@deepseek-ai/dsh-skill'
import {scopeOf} from '@deepseek-ai/dsh-scope'
import {members,provider} from './skills-content.mjs'
export const name='qcu-accounting-suite'
export const inject=['skills']
export async function apply(ctx,config){
 if(config?.enabled!==true)throw Error('Explicit activation required')
 const existing=await ctx.skills.list({scope:scopeOf(ctx)})
 for(const member of members){
  if(existing.some(skill=>skill.name===member.name))throw Error('Existing '+member.name+' skill; no overwrite')
  const actual=await readFile(new URL(member.file,import.meta.url),'utf8')
  if(actual!==member.content||createHash('sha256').update(actual).digest('hex')!==member.sha256)throw Error('Skill integrity failure: '+member.name)
 }
 const invocation=Object.freeze({modelInvocable:true,userInvocable:true}),resourceBase={kind:'directory',path:fileURLToPath(new URL('.',import.meta.url))}
 const definitions=members.map(member=>Object.freeze({name:member.name,description:member.description,source:provider,provider,content:member.content,invocation,resourceBase}))
 const candidates=definitions.map(def=>Object.freeze({name:def.name,description:def.description,source:provider,provider,invocation,resourceBase,rank:BUNDLED_SKILL_RANK,locator:def.name}))
 // One provider contribution: validation precedes registration; dispose removes all members together.
 ctx.skills.registerProvider(()=>({name:provider,list:async()=>candidates,get:async selected=>definitions.find(def=>def.name===selected.name&&def.name===selected.locator)}))
}
