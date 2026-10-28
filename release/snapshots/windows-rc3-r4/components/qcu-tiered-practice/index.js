// Build-time template, copied into each fixed provider. No runtime loader.
import {createHash} from 'node:crypto'
import {BUNDLED_SKILL_RANK} from '@deepseek-ai/dsh-skill'
import {scopeOf} from '@deepseek-ai/dsh-scope'
import {content,contentSha256,skillName,description,provider} from './skill-content.js'
export const name=skillName
export const inject=['skills']
export async function apply(ctx,config){
  if(config?.enabled!==true)throw Error('Explicit activation required')
  if(createHash('sha256').update(content,'utf8').digest('hex')!==contentSha256)throw Error('Skill integrity failure')
  if((await ctx.skills.list({scope:scopeOf(ctx)})).some(skill=>skill.name===skillName))throw Error('Existing '+skillName+' skill; no overwrite')
  const invocation=Object.freeze({modelInvocable:true,userInvocable:true})
  const definition=Object.freeze({name:skillName,description,source:provider,provider,content,invocation})
  const candidate=Object.freeze({name:skillName,description,source:provider,provider,invocation,rank:BUNDLED_SKILL_RANK,locator:skillName})
  // Official registration throws atomically for the exact provider name in
  // this layer, including concurrent copies that observed the same empty list.
  // Cordis owns this effect; disposal removes only this provider contribution.
  ctx.skills.registerProvider(()=>({name:provider,list:async()=>[candidate],get:async selected=>selected.locator===skillName&&selected.name===skillName?definition:undefined}))
}
