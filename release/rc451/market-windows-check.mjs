import assert from 'node:assert/strict'
import {mkdtemp,mkdir,rm,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
const src=resolve(process.argv[2]),root=await mkdtemp(join(tmpdir(),'qcu-acl-negative-'))
try{const {assertPlatformPrivate}=await import(pathToFileURL(join(src,'platform-private.mjs'))),dir=join(root,'private');await mkdir(dir);await assertPlatformPrivate(dir);execFileSync('icacls.exe',[dir,'/grant','*S-1-1-0:(OI)(CI)R'],{stdio:'ignore',windowsHide:true});await assert.rejects(assertPlatformPrivate(dir),/ACL/);const link=join(root,'junction');await symlink(dir,link,'junction');await assert.rejects(assertPlatformPrivate(link));console.log(JSON.stringify({passed:true,checks:['valid-Windows-owner-ACL','Everyone-access-refused','junction-refused']}))}finally{await rm(root,{recursive:true,force:true})}
