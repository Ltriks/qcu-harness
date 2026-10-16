import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {lessonInput,fixtureDraft} from '../tests/support/course-fixture.mjs'
import {exportArtifact} from '../hub/plugins/qcu-course-workbench/src/export.mjs'
import {COMPONENTS} from '../hub/plugins/qcu-course-workbench/src/protocol.mjs'
const out=resolve(process.argv[2]??'.work/course-validation/exports');await mkdir(out,{recursive:true});const input=lessonInput(),task={input,draft:fixtureDraft(input)}
for(const id of ['lesson',...input.components]){const ext=COMPONENTS.find(c=>c.id===id)?.format??'docx';await writeFile(join(out,id+'.'+ext),exportArtifact(task,id))}
console.log(out)
