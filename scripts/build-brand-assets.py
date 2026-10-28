#!/usr/bin/env python3
import argparse, base64, json, shutil, struct, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,required=True);args=parser.parse_args()
    args.out.mkdir(parents=True,exist_ok=True)
    renderer=args.out/'render-icon'
    subprocess.run(['/usr/bin/xcrun','swiftc',str(ROOT/'scripts/render-qcu-icon.swift'),'-o',str(renderer)],check=True)
    subprocess.run([str(renderer.resolve()),str(args.out.resolve())],check=True)
    iconset=args.out/'QCU.iconset';iconset.mkdir(exist_ok=True)
    for size in [16,32,128,256,512]:
        for density in [1,2]:
            name='icon_'+str(size)+'x'+str(size)+('@2x' if density==2 else '')+'.png'
            shutil.copyfile(args.out/('icon-'+str(size*density)+'.png'),iconset/name)
    subprocess.run(['/usr/bin/iconutil','-c','icns',str(iconset),'-o',str(args.out/'QCU.icns')],check=True)
    sizes=[16,24,32,48,64,128,256];parts=[(args.out/('icon-'+str(s)+'.png')).read_bytes() for s in sizes]
    offset=6+16*len(parts);entries=[]
    for size,data in zip(sizes,parts):
        entries.append(struct.pack('<BBBBHHII',size%256,size%256,0,0,1,32,len(data),offset));offset+=len(data)
    (args.out/'QCU.ico').write_bytes(struct.pack('<HHH',0,1,len(parts))+b''.join(entries)+b''.join(parts))
    svg=(ROOT/'branding/qcu-assistant/icon.svg').read_bytes()
    source='\n'.join((ROOT/'tools/teacher-branding/src'/name).read_text().replace('export ','') for name in ['tasks.mjs','theme.mjs','view.mjs','plugin.mjs'])
    client=(ROOT/'tools/teacher-branding/client.template.js').read_text().replace('__QCU_TEACHER_SOURCE__',source).replace('__QCU_ICON_DATA__','data:image/svg+xml;base64,'+base64.b64encode(svg).decode())
    package=args.out/'qcu-branding';package.mkdir(exist_ok=True)
    (package/'client.js').write_text(client)
    for name in ['package.json','index.js','cordis.patch.yml']:
        shutil.copyfile(ROOT/'tools/teacher-branding'/name,package/name)
    shutil.copyfile(ROOT/'LICENSE',package/'LICENSE')
    shutil.copyfile(ROOT/'branding/qcu-assistant/icon.svg',package/'icon.svg')
    print(json.dumps({'assets':str(args.out.resolve()),'name':'QCU助手'}))
if __name__=='__main__':main()
