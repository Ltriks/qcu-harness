// Actual shipped Electron/ASAR profile resolution; synthetic workspace, no base services/models.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
(async()=>{
 const [kit,home]=process.argv.slice(2),resources=path.join(kit,'program/DeepSeek Harness.app/Contents/Resources');
 console.log('INTEGRATED_STAGE:runtime');
 const {runtime}=require(path.join(kit,'support/offline.cjs')),actual=await runtime(resources),dir=path.join(home,'profiles/desktop');
 const {createRequire}=require('node:module'),config=JSON.parse(fs.readFileSync(path.join(kit,'support/integrated-inputs.json'))),req=createRequire(path.join(config.officialSdk,'package.json'));
 const load=id=>import(pathToFileURL(req.resolve(id))),useSdk=process.env.QCU_INTEGRATED_SDK_ONLY==='1',api=useSdk?{req,load,boot:await load('@deepseek-ai/dsh-app-boot'),anchor:path.join(config.officialSdk,'upstream/source/apps/desktop-host/package.json')}:actual;
 const mutable=process.env.QCU_INTEGRATED_MUTABLE_PROFILE==='1',pkgConfig=JSON.parse(fs.readFileSync(path.join(dir,'package.json'))),patchConfig=actual.req('js-yaml').load(fs.readFileSync(path.join(dir,'cordis.patch.yml'),'utf8')),selected=id=>pkgConfig.dsh.profile.bundles.includes(id)&&!patchConfig.some(r=>r.id===id&&r.disabled===true);
 if(mutable){assert.equal(pkgConfig.dsh.profile.bundles.includes('qcu-synthetic-integration-proof'),false);assert.equal(pkgConfig.dsh.profile.bundles.includes('qcu-study-coach'),false);assert.ok(patchConfig.some(r=>r.id==='qcu-study-coach'&&r.disabled));}
 const m=JSON.parse(fs.readFileSync(path.join(kit,'support/manifest.json'))),profile=api.boot.loadProfileDirectory('dsh',dir,api.anchor),actualProfile=actual.boot.loadProfileDirectory('dsh',dir,actual.anchor);
 assert.deepEqual(actualProfile.skippedBundles,[]);if(mutable)assert.ok(!actualProfile.layers.some(l=>l.packageName==='qcu-synthetic-integration-proof'));
 for(const p of m.localSources.filter(p=>!mutable||pkgConfig.dsh.profile.bundles.includes(p.id)))assert.ok(actualProfile.layers.some(l=>l.packageName===p.id));
 assert.deepEqual(profile.skippedBundles,[]);
 console.log('INTEGRATED_STAGE:resolution');
 const resolution=await api.boot.createRuntimeResolution({installAnchor:api.anchor,profile,home});
 const {Context}=api.req('@deepseek-ai/cordis'),ctx=new Context();
 try{
  console.log('INTEGRATED_STAGE:services');
  new api.boot.PluginPackages(ctx,{resolution});
  const {Loader}=await api.load('@deepseek-ai/cordis-plugin-loader'),{SkillRegistry}=await api.load('@deepseek-ai/dsh-skill'),{TypertRegistry}=await api.load('@deepseek-ai/dsh-typert-registry');
  console.log('INTEGRATED_STAGE:registries');
  new SkillRegistry(ctx);new TypertRegistry(ctx);
  const {default:SystemPrompt}=await api.load('@deepseek-ai/dsh-system-prompt'),{default:ToolRuntime}=await api.load('@deepseek-ai/dsh-tools');
  console.log('INTEGRATED_STAGE:prompt');
  async function ready(fork,label){let timer;try{await Promise.race([fork.await(),new Promise((_,no)=>{timer=setTimeout(()=>no(Error('Cold fixture dependency timeout: '+label)),5000)})])}catch(e){console.error(e);throw e}finally{clearTimeout(timer)}}
  await ready(ctx.plugin(SystemPrompt),'systemPrompt');console.log('INTEGRATED_STAGE:tools');await ready(ctx.plugin(ToolRuntime),'tools');
  let calls=0;ctx.reflect.provide('workspaceRegistry',{list:()=>[{id:'synthetic',title:'Synthetic workspace',path:path.join(home,'workspace')}],get:()=>undefined});
  ctx.reflect.provide('agentDefaultModel',{currentSelection:()=>{calls++;throw Error('Model lookup must not occur')}});
  const loader=new Loader(ctx,{baseUrl:pathToFileURL(path.join(dir,'cordis.yml')).href});loader.write=()=>{};
  const imports=[];
  for(const p of m.localSources.filter(p=>!mutable||selected(p.id))){
   console.log('INTEGRATED_IMPORT:'+p.id);
   const module=await loader.import(p.id),pkg=ctx.pluginPackages.packageOf(p.id,loader.ctx.baseUrl);
   assert.equal(pkg.version,p.version);assert.equal(fs.realpathSync(pkg.dir),fs.realpathSync(path.join(dir,'node_modules',p.id)));
   const fork=ctx.plugin(module,{enabled:true});await ready(fork,p.id);imports.push({id:p.id,version:pkg.version,profileResolved:true});
  }
  const skills=[];
  for(const p of m.products.filter(p=>(!mutable||selected(p.id))&&p.id!=='qcu-market'&&p.id!=='qcu-expert-teams'&&p.id!=='qcu-feishu-readonly'&&p.id!=='qcu-course-workbench')){
   const skill=await ctx.skills.get(p.id);assert.ok(skill?.content?.trim());const sealed=await import(pathToFileURL(path.join(dir,'node_modules',p.id,'skill-content.js')));assert.equal(skill.content,sealed.content);const sha256=require('node:crypto').createHash('sha256').update(skill.content).digest('hex');assert.equal(sha256,sealed.contentSha256);skills.push({id:p.id,provider:skill.provider,bytes:Buffer.byteLength(skill.content),sha256,sealedInstructionsVerified:true});
  }
  assert.equal(skills.length,mutable?6:7);
  const course=await ctx.skills.get('qcu-course-draft');assert.equal(course.provider,'qcu-course-workbench@0.1.0-pilot.1.3');
  assert.equal(JSON.parse(await ctx.qcuCourse.dispatch('{"action":"workspaces"}')).workspaces[0].id,'synthetic');
  assert.equal(JSON.parse(await ctx.qcuTeams.dispatch('{"action":"workspaces"}')).value[0].id,'synthetic');
  assert.equal(JSON.parse(await ctx.qcuMarket.status()).version,'0.1.0-pilot.15.2');assert.equal(calls,0);
  console.log('INTEGRATED_COLD:'+JSON.stringify({runtime:process.version,officialSdk:useSdk,actualZipModules:true,userProfileRespected:mutable,unselectedExtraStarted:false,actualAsarProfileMetadata:true,actualAsarNativeResolution:useSdk?'pending-OS-local-execution-approval':true,anchor:api.anchor,imports,skills,courseSkill:{provider:course.provider,bytes:Buffer.byteLength(course.content)},services:['qcuCourse','qcuTeams','qcuMarket'],profileLayers:profile.layers.map(l=>l.packageName),skippedBundles:profile.skippedBundles,syntheticProviders:true,networkGuard:globalThis.QCU_OFFLINE_NETWORK_GUARD===true,modelCalls:0,packageManagerCalls:0}));
 }finally{await ctx.fiber.dispose()}
})().catch(e=>{console.error(e);process.exitCode=1});
