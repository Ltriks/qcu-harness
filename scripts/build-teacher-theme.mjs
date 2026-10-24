// Rebuild the UI package without recompiling native icon assets or downloading dependencies.
import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(process.argv[2]??join(root,'.work/qcu-teacher-theme/qcu-branding'));
const sourceRoot=join(root,'tools/teacher-branding');
const manifest=JSON.parse(await readFile(join(sourceRoot,'package.json'),'utf8'));
const parts=await Promise.all(['tasks','theme','view','plugin'].map(n=>readFile(join(sourceRoot,'src',n+'.mjs'),'utf8')));
const icon='data:image/svg+xml;base64,'+(await readFile(join(root,'branding/qcu-assistant/icon.svg'))).toString('base64');
const template=await readFile(join(sourceRoot,'client.template.js'),'utf8');
const client=template.replace('__QCU_TEACHER_SOURCE__',parts.join('\n').replace(/^export /gm,'')).replace('__QCU_ICON_DATA__',icon)
 .replace(/QCU清蓝 \d+\.\d+\.\d+/,()=> 'QCU清蓝 '+manifest.version);
new Script(client,{filename:'qcu-branding/client.js'});
await mkdir(out,{recursive:true});await writeFile(join(out,'client.js'),client);
for(const name of ['package.json','index.js','cordis.patch.yml'])await copyFile(join(sourceRoot,name),join(out,name));
await copyFile(join(root,'LICENSE'),join(out,'LICENSE'));
await copyFile(join(root,'branding/qcu-assistant/icon.svg'),join(out,'icon.svg'));
console.log(JSON.stringify({package:out,version:manifest.version,bytes:Buffer.byteLength(client)}));
