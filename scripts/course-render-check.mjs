// Read/render synthetic exports using the already audited official Office engine.
import {createRequire} from 'node:module'
import {resolve,join} from 'node:path'
import {mkdir,writeFile} from 'node:fs/promises'
const require=createRequire(resolve(process.env.QCU_OFFICIAL_DEPENDENCIES,'package.json'))
const {createConverter}=await import(require.resolve('@deepseek-ai/libreoffice-kit'))
const root=resolve(process.env.QCU_COURSE_VALIDATION_ROOT??'.work/course-validation'),converter=await createConverter({timeoutMs:60000,fontMetadataCacheDirectory:false})
const results=[]
try{
 for(const name of ['lesson.docx','ppt.pptx']){
  const outputPath=join(root,name.replace('.','-')+'-render.pdf')
  const result=await converter.render({inputPath:join(root,'exports',name),outputPath});results.push({name,...result});console.log(name+' → '+outputPath)
 }
}finally{await converter.dispose()}
await writeFile(join(root,'render-report.json'),JSON.stringify(results,null,2))
