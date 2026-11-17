import {readFile,lstat,realpath} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'

const allowed=new Set(['qcu-deep-research','qcu-document-team','qcu-data-copilot','qcu-ket-prep','qcu-ncre-prep'])
async function bytes(root,name,max=200000){
 if(!/^[a-zA-Z0-9_./-]+$/.test(name)||name.split('/').includes('..')||resolve(root,name)===root||!resolve(root,name).startsWith(resolve(root)+'/'))throw Error('Invalid team resource')
 let current=root
 for(const part of name.split('/')){current=join(current,part);if((await lstat(current)).isSymbolicLink())throw Error('Symlink team resource')}
 const info=await lstat(current);if(!info.isFile()||info.size>max)throw Error('Invalid team resource size')
 return readFile(current)
}
export async function discoverInstalledTeams(registry,cwd,signal,{profileDir,bundles=[]}={}){
 const rows=registry?await registry.list({cwd,signal}):[],result=[]
 const candidates=new Map(rows.filter(r=>allowed.has(r.name)).map(r=>[r.name,r]))
 for(const bundle of bundles.filter(b=>allowed.has(b.name)&&b.installed))if(!candidates.has(bundle.name))candidates.set(bundle.name,{name:bundle.name})
 for(const candidate of candidates.values()){
  signal?.throwIfAborted()
  const skill=await registry?.get(candidate.name,{cwd,signal})
  const bundle=bundles.find(b=>b.name===candidate.name&&b.installed)
  try{
   let root,description
   if(skill?.resourceBase?.kind==='directory'){root=skill.resourceBase.path;description=skill.description}
   else if(profileDir&&bundle){
    const profile=await realpath(profileDir);root=await realpath(join(profileDir,'node_modules',candidate.name))
    if(!root.startsWith(profile+'/'))throw Error('Installed package outside profile')
    const pkg=JSON.parse(await bytes(root,'package.json'))
    if(pkg.name!==candidate.name||pkg.version!==bundle.version)throw Error('Installed package identity mismatch')
    description=pkg.description||candidate.name
   }else continue
   const manifest=JSON.parse(await bytes(root,'manifest.json'))
   const source=JSON.parse(await bytes(root,'SOURCE.json'))
   if(manifest.id!==candidate.name||manifest.execution!=='native-dsh-agent'||!Array.isArray(manifest.roles)||manifest.roles.length<1||manifest.roles.length>12)throw Error('Invalid team manifest')
   const members=[]
   for(const role of manifest.roles){
    if(!/^[a-z0-9-]+$/.test(role.id)||role.path!==`references/agents/${role.id}.md`)throw Error('Invalid team member')
    const raw=await bytes(root,role.path),pin=source.upstreamFiles?.find(p=>p.localPath===role.path)
    if(!pin||pin.bytes!==raw.length||pin.sha256!==createHash('sha256').update(raw).digest('hex'))throw Error('Team resource hash mismatch')
    const instructions=raw.toString('utf8'),heading=instructions.split('\n').find(line=>/^# .+/.test(line))
    members.push({id:role.id,name:heading?.replace(/^# /,'').slice(0,180)||role.id,instructions})
   }
   if(new Set(members.map(m=>m.id)).size!==members.length||!members.some(m=>m.id===manifest.lead))throw Error('Incomplete team roster')
   result.push({id:manifest.id,name:manifest.title,description:description.slice(0,1000),execution:'native-dsh-agent',enabled:!!skill&&bundle?.enabled!==false,sourceKind:source.sourceKind,revision:source.revision,members,lead:manifest.lead})
  }catch{result.push({id:candidate.name,name:candidate.name,description:'已安装团队的资源校验未通过，请在市场核对或重新安装。',execution:'native-dsh-agent',unavailable:true,members:[]})}
 }
 return result
}
