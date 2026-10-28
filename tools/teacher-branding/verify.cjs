/* Verify the brand against the actual bundled slot registry and React renderer. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {runtime}=require('../offline-suite/offline.cjs');
(async()=>{
 const [resources,brandDir,reactRoot]=process.argv.slice(2);const api=await runtime(resources),factories=new Map(),modules=new Map();
 const testRequire=require('node:module').createRequire(path.join(path.resolve(reactRoot),'package.json'));
 const sandbox={window:{__ModuleLoader__:{load:m=>factories.set(m.id,m.factory)}}};
 function browser(name){
  if(modules.has(name))return modules.get(name);
  if(name.startsWith('react'))return testRequire(name);
  if(name==='@deepseek-ai/cordis'||name==='@deepseek-ai/dsh-client-ui-slots')return api.req(name);
  if(!factories.has(name))vm.runInNewContext(fs.readFileSync(api.req.resolve(name+'/client'),'utf8'),sandbox,{filename:name});
  const module=factories.get(name)(browser);modules.set(name,module);return module;
 }
 vm.runInNewContext(fs.readFileSync(path.join(brandDir,'client.js'),'utf8'),sandbox,{filename:'qcu-branding'});
 const {Context}=api.req('@deepseek-ai/cordis'),ctx=new Context();
 try{
  const {SlotRegistry}=browser('@deepseek-ai/dsh-client-ui-renderer');
  const slots=new SlotRegistry(ctx);
  const declarations={};for(const name of ['sidebar.brand.mark','sidebar.brand.name','conversation.hero.brand.mark'])declarations[name]={kind:'single',scope:'root'};
  slots.register({name:'root',children:declarations},()=>null);
  const brand=browser('qcu-branding');const fork=ctx.plugin(brand);await fork.await();
  const render=testRequire('react-dom/server').renderToStaticMarkup,React=testRequire('react');
  const markup={};
  for(const name of Object.keys(declarations)){
   const rows=slots._core.entries(name);assert.equal(rows.length,1,name+' must have one occupant');
   const row=rows[0];const component=row.component||row.value?.component||row.value;
   markup[name]=render(React.createElement(component,{size:24}));
  }
  assert.match(markup['sidebar.brand.name'],/QCU助手/);assert.match(markup['sidebar.brand.mark'],/data:image\/svg\+xml;base64,/);
  console.log('QCU_BRAND_VERIFIED:'+JSON.stringify({officialSlotRegistry:true,reactServerRendering:true,slots:Object.keys(markup),markup}));
 }finally{await ctx.fiber.dispose()}
})().catch(e=>{console.error(e);process.exitCode=1});
