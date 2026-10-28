/* Cold-process check using the actual bundled core and installed providers; no models or GUI. */
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {runtime}=require('./offline.cjs');
(async()=>{
 const [resources,home,kit]=process.argv.slice(2).map(p=>path.resolve(p));process.env.DSH_HOME=home;
 const api=await runtime(resources),m=JSON.parse(fs.readFileSync(path.join(kit,'manifest.json'),'utf8'));
 const dir=path.join(home,'profiles','desktop');
 const profile=api.boot.loadProfileDirectory('dsh',dir,api.anchor);
 const resolution=await api.boot.createRuntimeResolution({installAnchor:api.anchor,profile,home});
 const {Context}=api.req('@deepseek-ai/cordis'),ctx=new Context();
 try{
  new api.boot.PluginPackages(ctx,{resolution});
  const {SkillRegistry}=await api.load('@deepseek-ai/dsh-skill');new SkillRegistry(ctx);
  const {TypertRegistry}=await api.load('@deepseek-ai/dsh-typert-registry');new TypertRegistry(ctx);
  const imports=[];
  for(const product of m.products){
   const file=path.join(dir,'node_modules',product.id,'index.js');const mod=await import(pathToFileURL(file));imports.push(product.id);
   if(product.teachingPreset&&product.id!=='qcu-market'){const fork=ctx.plugin(mod,{enabled:true});await fork.await()}
  }
  const ids=m.products.filter(p=>p.teachingPreset&&p.id!=='qcu-market').map(p=>p.id),skills=[];
  for(const id of ids){const skill=await ctx.skills.get(id);if(!skill?.content?.trim())throw Error('Skill not available: '+id);skills.push({id,provider:skill.provider,bytes:Buffer.byteLength(skill.content)})}
  console.log('QCU_OFFLINE_SMOKE:'+JSON.stringify({platform:process.platform,arch:process.arch,imports,skills,networkGuard:globalThis.QCU_OFFLINE_NETWORK_GUARD===true,modelCalls:0,guiTested:false}));
 }finally{await ctx.fiber.dispose()}
})().catch(e=>{console.error(e);process.exitCode=1});
