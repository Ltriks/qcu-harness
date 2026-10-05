import {readFile} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
export const name='qcu-thesis-workbench';
export const inject=['tools'];
const names=['qcu_thesis_open','qcu_thesis_check'];
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
export function apply(ctx,config={}){
  if(!isAbsolute(config.bridgePath||''))throw new Error('Configure an absolute bridgePath.');
  if(config.strictMode!==false && typeof ctx.tools.guard!=='function')throw new Error('This DSH version lacks the required tool guard.');
  const disposers=[];
  const active=new Set();
  let disposed=false;
  if(config.strictMode!==false){
    const hasAttachment=value=>{
      if(!value||typeof value!=='object')return false;
      if(['file','image','attachment','file_attachment','image_attachment'].includes(value.type))return true;
      return Object.values(value).some(v=>Array.isArray(v)?v.some(hasAttachment):hasAttachment(v));
    };
    // DSH 0.2.0-rc.2 authenticated HTTP admission runs before body transfer.
    disposers.push(ctx.on('connection/request',async(request,response,next)=>{
      let pathname;
      try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);}
      catch{response.writeHead(400);response.end();return;}
      if(pathname==='/api/session/uploadFileBinary'||pathname.startsWith('/api/fileUploads/')||pathname==='/api/file'){
        response.writeHead(403,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        response.end(JSON.stringify({error:{code:'qcu/attachment-blocked',message:'请在 QCU 本机工作台选择文档；论文不通过 DSH 附件通道传入。'}}));
        return;
      }
      await next();
    }));
    // Reject binary input before the agent admits a step; retain a second
    // boundary for model calls authored outside the ordinary agent loop.
    disposers.push(ctx.on('agent/pre-step',async(payload,next)=>hasAttachment(payload.messages)?{kind:'reject'}:next()));
    disposers.push(ctx.on('llm/stream',async function*(options,next){
      if(hasAttachment(options.messages))throw new Error('QCU thesis profile accepts text commands only; use the local workbench for documents.');
      yield* next();
    }));
  }
  if(config.strictMode!==false)disposers.push(ctx.tools.guard(exec=>names.includes(exec.name)?undefined:'QCU dedicated thesis profile permits only local thesis tools.'));
  async function bridge(){
    const b=JSON.parse(await readFile(config.bridgePath,'utf8'));
    if(!/^http:\/\/127\.0\.0\.1:[0-9]{1,5}$/.test(b.base_url)||typeof b.token!=='string'||b.token.length<32)throw new Error('Invalid bridge');
    return b;
  }
  async function execute(args,exec={},check=false){
    try{
      if(disposed||exec.signal?.aborted)throw new Error('Cancelled');
      if(!args||Array.isArray(args)||typeof args!=='object'||Object.keys(args).some(k=>!(check?['document_id','rule_id']:[]).includes(k)))throw new Error('Invalid input');
      if(check&&(!/^[0-9a-f]{32}$/.test(args.document_id||'')||typeof args.rule_id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(args.rule_id)))throw new Error('Invalid input');
      const b=await bridge();
      if(disposed||exec.signal?.aborted)throw new Error('Cancelled');
      if(!check)return {status:'ready',workbench_access:'native-panel',message:'请打开对话顶部“工具”中的“论文检查”面板选择文档和规则。'};
      const abort=new AbortController();
      active.add(abort);
      const cancel=()=>abort.abort();
      if(exec.signal?.aborted)abort.abort();
      exec.signal?.addEventListener('abort',cancel,{once:true});
      const timer=setTimeout(cancel,30000);
      try{
        const response=await fetch(b.base_url+'/bridge/run',{method:'POST',redirect:'error',signal:abort.signal,headers:{'Content-Type':'application/json','X-QCU-Bridge':b.token},body:JSON.stringify(args)});
        if(!response.ok)throw new Error('Request failed');
        const value=await response.json();
        if(disposed||abort.signal.aborted)throw new Error('Cancelled');
        if(!/^[0-9a-f]{32}$/.test(value.report_id)||!['demo','personal','center'].includes(value.rule_source)||!['passed','failed','unknown'].every(k=>Number.isSafeInteger(value.counts?.[k])&&value.counts[k]>=0))throw new Error('Invalid response');
        // Reconstruct an allowlist: never forward excerpts, errors, tokens or paths.
        return {status:'completed',report_access:'native-panel',message:'请在“论文检查”面板查看完整报告，进入报告后点击“保存 HTML 报告”；取消后可再次保存。不要把本机报告或下载地址写成聊天链接。',rule_source:value.rule_source,counts:Object.fromEntries(['passed','failed','unknown'].map(k=>[k,value.counts[k]]))};
      }finally{active.delete(abort);clearTimeout(timer);exec.signal?.removeEventListener('abort',cancel);}
    }catch{return {status:'unavailable',message:'请在本机页面确认服务、文档授权及规则；正文和详细错误不会传入对话。'};}
  }
  try{
    for(const [index,id] of names.entries())disposers.push(ctx.tools.register({name:id,description:index?'仅在用户明确请求检查或继续已授权检查并提供文档和规则编号时调用；仅返回计数和原生面板操作说明，不返回本机 URL。普通聊天和切换话题不调用。':'仅在用户明确要求打开论文工作台或开始论文格式检查时确认本机面板就绪。普通问候、概念解释和其他话题直接回答，不调用本工具。打开页面不等于授权检查，不读取论文或报告。',parameters:index?object({document_id:{type:'string'},rule_id:{type:'string'}}):object({}),output:{schema:{type:'object'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},execute:(args,exec)=>execute(args,exec,index===1)}));
  }catch(error){for(const dispose of disposers.reverse())dispose();throw error;}
  return ()=>{
    if(disposed)return;
    disposed=true;
    for(const abort of active)abort.abort();
    active.clear();
    for(const dispose of disposers.reverse())dispose();
  };
}
