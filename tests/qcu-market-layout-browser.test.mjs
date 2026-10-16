// Rendered geometry and navigation checks against the shared React UI, synthetic backend only.
import test from "node:test"
import assert from "node:assert/strict"
import {createRequire} from "node:module"
import {resolve} from "node:path"
import {createServer} from "node:http"
import {readFile,mkdir,writeFile} from "node:fs/promises"
const require=createRequire(resolve(process.env.QCU_BROWSER_DEPENDENCIES,"package.json"))
const {chromium}=require("playwright"),out=process.env.QCU_MARKET_PREVIEW_OUT
if(!out)throw Error("Build preview.mjs with QCU_MARKET_PREVIEW_OUT first")
test("refresh: rendered layout, full guide progress, universal exit and zero browsing RPC",async t=>{
 const server=createServer(async(req,res)=>{
  const name=req.url==="/"?"index.html":req.url==="/app.js"?"app.js":null
  if(!name){res.writeHead(404).end();return}
  res.setHeader("Content-Type",name.endsWith(".js")?"text/javascript":"text/html")
  res.end(await readFile(resolve(out,name)))
 })
 await new Promise((r,j)=>{server.once("error",j);server.listen(0,"127.0.0.1",r)})
 t.after(()=>new Promise(r=>server.close(r)))
 const url=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true})
 t.after(()=>browser.close())
 const page=await browser.newPage({viewport:{width:1120,height:900}}),errors=[],outside=[],metrics=[]
 page.on("pageerror",e=>errors.push(e.message))
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())})
 await page.route("**/*",r=>{
  if(![url+"/",url+"/app.js"].includes(r.request().url())){outside.push(r.request().url());return r.abort()}
  return r.continue()
 })
 const button=name=>page.getByRole("button",{name,exact:true})
 const calls=()=>page.evaluate(()=>window.qcuPreview.calls)
 const screenshots=resolve(out,"../screenshots/refresh")
 await mkdir(screenshots,{recursive:true})
 t.after(()=>writeFile(resolve(out,"../layout-metrics.json"),JSON.stringify(metrics,null,2)+"\n"))
 const shot=async name=>{
  // Expand only for capture; geometry assertions use the unmodified viewport first.
  await page.locator(".qcu-market").evaluate(el=>el.style.height="auto")
  try{await page.screenshot({path:resolve(screenshots,name+".png"),fullPage:true})}
  finally{await page.locator(".qcu-market").evaluate(el=>el.style.removeProperty("height"))}
 }
 const fit=async(width,theme,view)=>{
  const geometry=await page.evaluate(()=>{
   const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}}
   const nav=document.querySelector(".qcu-page-nav"),market=document.querySelector(".qcu-market")
   return {exit:rect(document.querySelector(".qcu-exit")),nav:rect(nav),buttons:[...nav.querySelectorAll("button")].map(el=>({...rect(el),text:el.textContent,fits:el.scrollWidth<=el.clientWidth&&el.scrollHeight<=el.clientHeight})),overflow:market.scrollWidth>market.clientWidth||document.documentElement.scrollWidth>innerWidth}
  })
  metrics.push({width,theme,view,...geometry})
  assert.equal(geometry.overflow,false,`${width} ${theme} ${view}: horizontal overflow`)
  assert.ok(geometry.nav.y-geometry.exit.bottom>=12,`${view}: exit and navigation need physical separation`)
  assert.deepEqual(geometry.buttons.map(b=>b.text),["市场首页","新手指引","常用任务","问题反馈"])
  for(const b of geometry.buttons){assert.ok(b.x>=geometry.nav.x-1&&b.right<=geometry.nav.right+1);assert.ok(b.height>=(width<=390?44:32));assert.ok(b.fits,`${b.text} clipped`)}
  if(width<=390)assert.ok(geometry.buttons.every(b=>Math.abs(b.y-geometry.buttons[0].y)<1),"narrow navigation should fit one row")
  for(let i=0;i<geometry.buttons.length;i++)for(const b of geometry.buttons.slice(i+1)){
   const a=geometry.buttons[i];assert.ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,"navigation overlap")
  }
  assert.equal(await button("← 返回对话").count(),1)
 }
 for(const theme of ["light","dark"])for(const width of [360,390,768,1120]){
  await t.test(`${theme} ${width}px home, guide, detail and auxiliary navigation`,async()=>{
   await page.setViewportSize({width,height:900});await page.goto(url)
   await button("查看QCU学习方法教练").waitFor()
   if(theme==="dark")await button("切换明暗").click()
   await fit(width,theme,"home")
   assert.equal(await page.locator(".qcu-product").count(),8)
   assert.equal(await page.locator(".qcu-product .qcu-badge").filter({hasText:"技能"}).count(),6)
   assert.equal(await page.locator(".qcu-product .qcu-badge").filter({hasText:"插件"}).count(),2)
   const cards=await page.locator(".qcu-product").evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,height:r.height}}))
   const columns=cards.filter(c=>Math.abs(c.y-cards[0].y)<1).length
   assert.equal(columns,width===1120?3:width===768?2:1)
   for(const c of cards)assert.ok(c.height>=140&&c.height<=(width>=768?165:180),`card height ${c.height}`)
   assert.equal(await page.locator(".qcu-onboarding").evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight}),true)
   assert.equal(await button("下载并查看安装确认").count(),0)
   await shot(`home-${theme}-${width}`)
   // Keyboard navigation opens the guide; the progress list does not add tab stops.
   await button("新手指引").focus();await page.keyboard.press("Enter")
   assert.equal(await page.locator("[data-page-heading]").evaluate(el=>el===document.activeElement),true)
   await fit(width,theme,"guide")
   assert.equal(await page.locator(".qcu-progress li").count(),5)
   for(let step=0;step<5;step++){
    assert.equal(await page.locator(".qcu-progress [aria-current=step]").count(),1)
    assert.equal(await page.locator(".qcu-progress li").nth(step).getAttribute("aria-current"),"step")
    assert.equal(await button("上一步").isDisabled(),step===0)
    if(step<4)await button("下一步").click()
   }
   await button("上一步").click();await button("稍后再看").click()
   assert.equal(await button("新手指引").evaluate(el=>el===document.activeElement),true)
   await button("新手指引").click()
   assert.equal(await page.locator(".qcu-progress li").nth(3).getAttribute("aria-current"),"step")
   await shot(`guide-${theme}-${width}`)
   await button("下一步").click();await button("完成引导").click()
   await page.getByText("已浏览引导（不代表已验收）；可随时从“新手指引”再看。",{exact:true}).waitFor()
   assert.deepEqual(await calls(),[])
   await button("查看备课教案与课堂活动").click();await fit(width,theme,"detail")
   await shot(`detail-${theme}-${width}`)
   await button("← 返回列表").click()
   assert.equal(await button("查看备课教案与课堂活动").evaluate(el=>el===document.activeElement),true)
   await button("常用任务").click();await button("备课教案").click();await button("填入完整合成示例").click()
   await fit(width,theme,"tasks");await button("查看对应技能详情").click();await button("← 返回列表").click()
   assert.ok((await page.locator("form textarea").first().inputValue()).includes("合成示例"))
   await button("问题反馈").click();await fit(width,theme,"feedback")
   assert.deepEqual(await calls(),[])
   // Exercise the newly available exit on each page, including task/detail reentry.
   for(const view of ["guide","tasks","feedback","detail"]){
    await button("市场首页").click()
    await button(view==="guide"?"新手指引":view==="tasks"?"常用任务":view==="feedback"?"问题反馈":"查看备课教案与课堂活动").click()
    await button("← 返回对话").click();assert.equal(await page.locator(".qcu-market").count(),0)
    await button("打开市场").click()
   }
   assert.deepEqual(await calls(),[])
  })
 }
 await t.test("full status meanings remain visible in compact cards",async()=>{
  await page.goto(url);await page.setViewportSize({width:360,height:900});await button("查看QCU学习方法教练").waitFor()
  await page.evaluate(()=>{
   const states=["not-installed","installed-disabled","row-disabled","component-active","restart-or-pending","conflict","failed"]
   window.qcuPreview.flows.forEach((flow,i)=>flow.set({phase:"idle",status:{state:states[i%states.length]}}))
  })
  for(const text of ["未安装","已安装 · 未启用","包已启用 · 组件未启用","组件已加载","等待加载或重启","需要核对版本","加载失败"]){
   // Check the text box itself, not CSS declarations or a fake rendered fixture.
   const status=page.locator(".qcu-card-footer").getByText(text,{exact:true}).first()
   assert.equal(await status.evaluate(el=>el.scrollWidth<=el.clientWidth&&el.scrollHeight<=el.clientHeight),true)
  }
  assert.deepEqual(await calls(),[])
 })
 await t.test("no outside requests or React errors",()=>{assert.deepEqual(errors,[]);assert.deepEqual(outside,[])})
})
