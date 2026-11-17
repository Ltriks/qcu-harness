const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
for(const platform of ['mac-arm64','win-x64'])test(platform+' new-build diagnostics validate and endpoint consent cannot migrate silently',()=>{
 const source=path.resolve('release/rc45',platform,'support'),tmp=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'qcu-report-test-'));
 try{
  const incidents=require(path.join(source,'incidents.cjs')),report=incidents.createIncident(Error('PRIVATE TEXT'),{suiteVersion:'0.1.0-rc.4.5',sourceKind:'self-test'});assert.equal(incidents.validReport(report),true);assert.equal(report.buildId,'rc45.1');assert.equal(JSON.stringify(report).includes('PRIVATE TEXT'),false);
  // Copy only the client module/config so each load sees the intended compiled receiver.
  for(const n of ['lan-report.cjs','incidents.cjs','reporting-endpoint.json'])fs.copyFileSync(path.join(source,n),path.join(tmp,n));
  const store=path.join(tmp,'store');fs.mkdirSync(store,{mode:0o700});const target=path.join(tmp,'lan-report.cjs'),config=path.join(tmp,'reporting-endpoint.json'),first=require(target);
  assert.equal(first.enabled(store),false);first.setPreference(store,true);assert.equal(first.enabled(store),true);
  fs.writeFileSync(config,JSON.stringify({id:'test-cloud',origin:'https://example.invalid',label:'Test cloud'}));delete require.cache[target];delete require.cache[config];const second=require(target);assert.notEqual(first.RECEIVER,second.RECEIVER);assert.equal(second.enabled(store),false);assert.equal(second.receiverLabel,'Test cloud');
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
})
test('slow private file validation does not consume the request deadline',async()=>{
 const vm=require('node:vm'),crypto=require('node:crypto'),os=require('node:os'),nativeDate=Date;
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'qcu-report-budget-'));fs.chmodSync(root,0o700);
 let offset=0,calls=0;class Clock extends nativeDate{static now(){return nativeDate.now()+offset}}
 try{
  const folder=path.resolve('release/rc45/mac-arm64/support'),incident=require(path.join(folder,'incidents.cjs')),report=incident.createIncident(Error('synthetic'),{suiteVersion:'0.1.0-rc.4.5',sourceKind:'self-test'});assert.equal(incident.saveIncident(report,root).saved,true);
  const file=path.join(folder,'lan-report.cjs'),module={exports:{}};
  const slowFs=new Proxy(fs,{get(target,key){if(key==='readFileSync')return(...args)=>{offset+=5000;return target.readFileSync(...args)};return target[key]}});
  const requireLocal=name=>name==='node:fs'?slowFs:name.startsWith('./')?require(path.join(folder,name)):require(name);
  vm.runInNewContext('(function(require,module,exports){'+fs.readFileSync(file,'utf8')+'\n})',{process,Buffer,URL,Date:Clock,AbortSignal,fetch,console})(requireLocal,module,module.exports);
  const lan=module.exports;lan.setPreference(root,true);
  const result=await lan.flush(root,{budgetMs:3000,fetcher:async(_url,options)=>{calls++;await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,20);options.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(Error('deadline expired'))},{once:true})});if(options.method==='GET')return new Response('',{status:404});const body=JSON.stringify({incidentId:report.incidentId,receiptId:crypto.createHash('sha256').update('QCU-INCIDENT/V1:'+report.incidentId).digest('hex'),receivedAt:new nativeDate().toISOString(),state:'received'});return new Response(body,{status:201,headers:{'content-length':String(Buffer.byteLength(body))}})}});
  assert.equal(result.received,1);assert.equal(calls,2)
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
