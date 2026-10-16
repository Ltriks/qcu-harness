import {createRequire} from 'node:module'
import {resolve,join} from 'node:path'
import {writeFile} from 'node:fs/promises'
const require=createRequire(resolve(process.env.QCU_OFFICIAL_DEPENDENCIES,'package.json'))
const {createConverter}=await import(require.resolve('@deepseek-ai/libreoffice-kit'))
const root=resolve('.work/course-validation'),converter=await createConverter({timeoutMs:60000,fontMetadataCacheDirectory:false}),reports=[]
try{for(const [name,pages] of [['lesson.docx',[1]],['ppt.pptx',[1,6]]]){const r=await converter.renderImages({inputPath:join(root,name.replace('.','-')+'-render.pdf'),outputDir:join(root,'images-pdf-'+name.replace('.','-')),pages,dpi:96});reports.push(r);console.log(JSON.stringify({name,pageCount:r.pageCount,images:r.images.map(i=>i.path),missingFonts:r.missingFonts}))}}finally{await converter.dispose()}
await writeFile(join(root,'image-report.json'),JSON.stringify(reports,null,2))
