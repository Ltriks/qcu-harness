import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {open} from 'node:fs/promises'
import {constants} from 'node:fs'
import {resolve,isAbsolute} from 'node:path'
const run=promisify(execFile)
export const currentUserOwns=stat=>process.platform==='win32'||stat.uid===process.getuid()
export const privateMode=(stat,mode)=>process.platform==='win32'||(stat.mode&0o777)===mode
// No POSIX UID exists on Windows. Validate its actual owner/ACL instead.
export async function assertPlatformPrivate(file){
 if(process.platform!=='win32')return
 if(!isAbsolute(file)||file.startsWith('\\\\'))throw Error('Private state requires a local absolute path')
 const script=`$ErrorActionPreference='Stop';$u=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$p=$env:QCU_MARKET_ACL_PATH;for($x=$p;$x;$x=[IO.Path]::GetDirectoryName($x)){if((Get-Item -LiteralPath $x -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){exit 13}};$a=Get-Acl -LiteralPath $p;if($a.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $u){exit 11};$ok=@($u,'S-1-5-18','S-1-5-32-544');foreach($r in $a.Access){if($r.AccessControlType -eq 'Allow' -and $ok -notcontains $r.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value){exit 12}}`;
 try{await run('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:10000,maxBuffer:1024,env:{...process.env,QCU_MARKET_ACL_PATH:resolve(file)}})}catch{throw Error('Private Windows ACL unavailable or unsafe')}
}
export async function syncPrivateDirectory(root){
 if(process.platform==='win32'){await assertPlatformPrivate(root);return}
 const f=await open(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{await f.sync()}finally{await f.close()}
}
