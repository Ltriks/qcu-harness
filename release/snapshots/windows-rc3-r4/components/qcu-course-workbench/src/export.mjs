import {deflateRawSync} from 'node:zlib'
import {artifactHtml,escape as x} from './artifact-html.mjs'
import {check,targetTitles,targetValue} from './protocol.mjs'
const XML='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const rels=items=>XML+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+items.map(([id,type,target])=>`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${x(target)}"/>`).join('')+'</Relationships>'
let crcTable
function crc32(b){crcTable??=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});let c=0xffffffff;for(const n of b)c=crcTable[(c^n)&255]^(c>>>8);return (c^0xffffffff)>>>0}
export function zip(files){
 const chunks=[],central=[];let offset=0
 for(const [name,value] of Object.entries(files)){
  const b=Buffer.from(value),n=Buffer.from(name),z=deflateRawSync(b),crc=crc32(b),local=Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);local.writeUInt16LE(33,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(z.length,18);local.writeUInt32LE(b.length,22);local.writeUInt16LE(n.length,26)
  chunks.push(local,n,z);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt16LE(33,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(z.length,20);c.writeUInt32LE(b.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=local.length+n.length+z.length
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...chunks,cd,end])
}
function types(overrides){return XML+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+overrides.map(([p,t])=>`<Override PartName="/${p}" ContentType="application/vnd.openxmlformats-officedocument.${t}+xml"/>`).join('')+'</Types>'}
function content(task,component){
 const d=task.draft,c=d.components.find(c=>c.id===component)
 return [{heading:d.title,body:'DRAFT · 教师审核草案\n'+task.input.topic},{heading:'Learning intentions · 学习目标',body:d.intentions.join('\n')},{heading:'Success criteria · 成功标准',body:d.criteria.join('\n')},{heading:'Vocabulary · 关键词',body:d.vocabulary.join('\n')},{heading:'Curriculum alignment · 课程目标',body:Object.entries(task.input).filter(([k])=>targetTitles[k]).map(([k,v])=>targetTitles[k]+': '+(Array.isArray(v)?v.map(targetValue).join(', '):['big_idea','real_world_link','career_link'].includes(k)?v:targetValue(v))).join('\n')},...(c?c.sections:d.sequence.map(s=>({heading:s.title+' · '+s.minutes+' min',body:'Teacher · 教师: '+s.teacher+'\n\nStudents · 学生: '+s.student+'\n\nEvidence · 评价证据: '+s.evidence}))),{heading:'Teacher review · 教师审核',body:'Verify knowledge, worked answers, curriculum alignment, sources and suitability before classroom use. 核实知识、答案、来源及适用性后再用于教学。'}]
}
export function docx(sections){
 const p=(s,style)=>'<w:p><w:pPr><w:pStyle w:val="'+style+'"/></w:pPr><w:r><w:t xml:space="preserve">'+x(s)+'</w:t></w:r></w:p>'
 const files={'[Content_Types].xml':types([['word/document.xml','wordprocessingml.document.main'],['word/styles.xml','wordprocessingml.styles']]),'_rels/.rels':rels([['rId1','officeDocument','word/document.xml']]),'word/_rels/document.xml.rels':rels([['rId1','styles','styles.xml']]),
 'word/document.xml':XML+'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+sections.map((s,i)=>p(s.heading,i===0?'Title':'Heading1')+s.body.split('\n').map(s=>p(s,'Normal')).join('')).join('')+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>',
 'word/styles.xml':XML+'<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="PingFang SC"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>'+[['Normal',22],['Title',40],['Heading1',28]].map(([id,size])=>'<w:style w:type="paragraph" w:styleId="'+id+'"><w:name w:val="'+id+'"/><w:pPr><w:spacing w:after="140"/>'+(id==='Normal'?'':'<w:keepNext/>')+'</w:pPr><w:rPr><w:sz w:val="'+size+'"/>'+(id==='Normal'?'':'<w:b/><w:color w:val="35795F"/>')+'</w:rPr></w:style>').join('')+'</w:styles>'}
 return zip(files)
}
const ns='xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
const tree='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
const colorMap='<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
function shape(id,title,body,y,h,size){return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${title}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="600000" y="${y}"/><a:ext cx="10992000" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>`+body.split('\n').map(s=>`<a:p><a:pPr/><a:r><a:rPr lang="en-US" sz="${size}"><a:solidFill><a:srgbClr val="${id===2?'35795F':'4A3C2E'}"/></a:solidFill><a:latin typeface="Arial"/><a:ea typeface="PingFang SC"/></a:rPr><a:t>${x(s)}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`).join('')+'</p:txBody></p:sp>'}
export function pptx(sections){
 const slides=[]
 for(const section of sections){const lines=section.body.match(/[\s\S]{1,700}(?:\s|$)|[\s\S]{1,700}/g)||[''];for(let i=0;i<lines.length;i++)slides.push({heading:section.heading+(lines.length>1?' ('+(i+1)+'/'+lines.length+')':''),body:lines[i]})}
 const files={'_rels/.rels':rels([['rId1','officeDocument','ppt/presentation.xml']]),'[Content_Types].xml':types([['ppt/presentation.xml','presentationml.presentation.main'],['ppt/slideMasters/slideMaster1.xml','presentationml.slideMaster'],['ppt/slideLayouts/slideLayout1.xml','presentationml.slideLayout'],['ppt/theme/theme1.xml','theme'],...slides.map((_,i)=>['ppt/slides/slide'+(i+1)+'.xml','presentationml.slide'])]),
 'ppt/presentation.xml':XML+`<p:presentation ${ns}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>`+slides.map((_,i)=>`<p:sldId id="${256+i}" r:id="rId${i+2}"/>`).join('')+'</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>',
 'ppt/_rels/presentation.xml.rels':rels([['rId1','slideMaster','slideMasters/slideMaster1.xml'],...slides.map((_,i)=>['rId'+(i+2),'slide','slides/slide'+(i+1)+'.xml'])]),
 'ppt/slideMasters/slideMaster1.xml':XML+`<p:sldMaster ${ns}><p:cSld><p:spTree>${tree}</p:spTree></p:cSld>${colorMap}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`,
 'ppt/slideMasters/_rels/slideMaster1.xml.rels':rels([['rId1','slideLayout','../slideLayouts/slideLayout1.xml'],['rId2','theme','../theme/theme1.xml']]),
 'ppt/slideLayouts/slideLayout1.xml':XML+`<p:sldLayout ${ns} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${tree}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
 'ppt/slideLayouts/_rels/slideLayout1.xml.rels':rels([['rId1','slideMaster','../slideMasters/slideMaster1.xml']]),
 'ppt/theme/theme1.xml':XML+'<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Course Studio"><a:themeElements><a:clrScheme name="Course Studio">'+Object.entries({dk1:'4A3C2E',lt1:'FFFFFF',dk2:'35795F',lt2:'FDF8F1',accent1:'3E8E74',accent2:'A9D8C9',accent3:'F6C6D1',accent4:'F8E6A6',accent5:'A3957F',accent6:'6E6052',hlink:'35795F',folHlink:'6E6052'}).map(([k,v])=>`<a:${k}><a:srgbClr val="${v}"/></a:${k}>`).join('')+'</a:clrScheme><a:fontScheme name="Course Studio"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface="PingFang SC"/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="PingFang SC"/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Course Studio"><a:fillStyleLst>'+Array(3).fill('<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>').join('')+'</a:fillStyleLst><a:lnStyleLst>'+Array(3).fill('<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>').join('')+'</a:lnStyleLst><a:effectStyleLst>'+Array(3).fill('<a:effectStyle><a:effectLst/></a:effectStyle>').join('')+'</a:effectStyleLst><a:bgFillStyleLst>'+Array(3).fill('<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>').join('')+'</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>'}
 slides.forEach((s,i)=>{files['ppt/slides/slide'+(i+1)+'.xml']=XML+`<p:sld ${ns}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FDF8F1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${tree}${shape(2,'Title',s.heading,300000,1000000,2800)}${shape(3,'Content',s.body,1400000,4850000,1800)}${shape(4,'Draft','DRAFT · Teacher review required · '+(i+1)+' / '+slides.length,6400000,300000,1000)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;files['ppt/slides/_rels/slide'+(i+1)+'.xml.rels']=rels([['rId1','slideLayout','../slideLayouts/slideLayout1.xml']])})
 return zip(files)
}
export function exportArtifact(task,component){
 const sections=content(task,component);let b
 if(component==='ppt')b=pptx(sections)
 else if(['lesson','guide','micro','hw','ticket','culture'].includes(component))b=docx(sections)
 else b=Buffer.from(artifactHtml(task,component))
 check(b.length<=4000000,'artifact-too-large');return b
}
