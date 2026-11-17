'use strict';
// Windows ACLs carry privacy; POSIX mode bits are not a Windows ACL check.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
function assertPrivate(file){
 if(process.platform!=='win32')throw Error('Windows ACL check requires Windows');
 for(let p=path.resolve(file);p!==path.dirname(p);p=path.dirname(p))if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error('Private path uses a link');
 const script=`$ErrorActionPreference='Stop';$u=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$a=Get-Acl -LiteralPath $env:QCU_ACL_CHECK_PATH;$owner=$a.GetOwner([Security.Principal.SecurityIdentifier]).Value;if($owner -ne $u){exit 11};$ok=@($u,'S-1-5-18','S-1-5-32-544');foreach($r in $a.Access){if($r.AccessControlType -eq 'Allow' -and $ok -notcontains $r.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value){exit 12}};exit 0`;
 const r=cp.spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:10000,stdio:'ignore',env:{...process.env,QCU_ACL_CHECK_PATH:path.resolve(file)}});
 if(r.error||r.status!==0)throw Error('Private Windows ACL unavailable or unsafe');
}
module.exports={assertPrivate};
