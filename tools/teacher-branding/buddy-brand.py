"""Apply the approved QCU Buddy display identity to an already managed frozen shell.

No auth, provider, security fuse, application ID, data path or update-policy changes.
"""
import hashlib
import importlib.util
import json
import plistlib
import re
import struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('managed_asar',ROOT/'tools/teacher-branding/managed-updates.py')
managed=importlib.util.module_from_spec(spec);spec.loader.exec_module(managed)

def sha(data):return hashlib.sha256(data).hexdigest()
def apply(kit,target):
    kit=Path(kit)
    resources=kit/('program/DeepSeek Harness.app/Contents/Resources' if target=='mac-arm64' else 'program/resources')
    archive=resources/'app.asar';original=archive.read_bytes()
    previous=json.loads((kit/'support/managed-updates.json').read_text())
    if sha(original)!=previous['customAsarSha256']:raise ValueError('Frozen managed ASAR mismatch')
    main=managed.member(original,'lib/main.js').decode()
    original_main=main
    # Display strings only; IDs, paths and the official authentication protocol stay intact.
    keys='aboutMenu|aboutProduct|hideApplication|quitApplication|openApplication|quitTitle|startupFailed|welcomeTitle|welcomeBrand|welcomeTaglineBrand|updateTitle|applicationName'
    main=re.sub(r'(?m)^(\s*(?:'+keys+r'): ")([^"\n]*)(",?)$',lambda m:m[1]+m[2].replace('DeepSeek Harness','QCU Buddy')+m[3],main)
    main=main.replace('QCU助手','QCU Buddy').replace('城院助手','QCU Buddy')
    main=main.replace('label: darwin ? app.name : currentDesktopLocale().messages.application', 'label: darwin ? \"QCU Buddy\" : currentDesktopLocale().messages.application')
    main=main.replace('welcomeDescription: "Build potential. Explore intelligence."','welcomeDescription: "Your teaching and research companion."').replace('welcomeDescription: "组装无限可能，共探智能上限"','welcomeDescription: "教学与教研助手"')
    policy=lambda text:text[text.index('var DesktopMandatoryUpdatePolicy = class'):text.index('//#endregion',text.index('var DesktopMandatoryUpdatePolicy = class'))]
    if policy(main)!=policy(original_main):raise ValueError('Minimum-version policy engine changed')
    package=json.loads(managed.member(original,'package.json'));previous_policy=package.get('dshMandatoryUpdatePolicy')
    # Preserve Electron's internal product name: OS secret-storage identity may use it.
    welcome=managed.member(original,'lib/welcome/welcome.js').decode()
    old='className:"brand",src:"assets/welcome-brand.svg",alt:S.welcomeBrand,width:"472",height:"40"'
    if welcome.count(old)!=1:raise ValueError('Welcome image anchor changed')
    welcome=welcome.replace(old,'className:"brand",src:"assets/welcome-brand.svg",alt:S.welcomeBrand,width:"68",height:"100"')
    preload_replacements={}
    for preload in ['lib/preload-app.cjs','lib/preload-welcome.cjs']:
        text=managed.member(original,preload).decode()
        text=re.sub(r'(?m)^(\s*(?:'+keys+r'): ")([^"\n]*)(",?)$',lambda m:m[1]+m[2].replace('DeepSeek Harness','QCU Buddy')+m[3],text)
        text=text.replace('welcomeDescription: "Build potential. Explore intelligence."','welcomeDescription: "Your teaching and research companion."').replace('welcomeDescription: "组装无限可能，共探智能上限"','welcomeDescription: "教学与教研助手"')
        if text.count('welcomeBrand: "QCU Buddy"')!=2:raise ValueError('Preload locale branding was not updated')
        preload_replacements[preload]=text.encode()
    css=managed.member(original,'renderer/welcome.css').decode()
    css+='\n/* QCU Buddy: approved symbol only, including a neutral plate for dark mode. */\n.welcome{grid-template-rows:100px minmax(0,1fr) 104px}\n.brand{width:68px;height:100px;object-fit:contain;background:#fff;border-radius:8px}\n'
    replacements={'lib/main.js':main.encode(),'lib/welcome/welcome.js':welcome.encode(),'renderer/welcome.css':css.encode(),'renderer/assets/welcome-brand.svg':(ROOT/'hub/plugins/qcu-branding/assets/qcu-symbol.svg').read_bytes()}
    replacements.update(preload_replacements)
    patched,unchanged=managed.replace_members(original,replacements)
    if json.loads(managed.member(patched,'package.json')).get('dshMandatoryUpdatePolicy')!=previous_policy:raise ValueError('Official minimum policy config changed')
    if 'QCU_MANAGED_UPDATES' not in main or '套件版本说明' not in main:raise ValueError('Managed update guard missing')
    assets=ROOT/'release/rc456/assets'
    archive.write_bytes(patched)
    (resources/'icon.png').write_bytes((assets/'app-icon-256.png').read_bytes())
    if target=='win-x64':
        (resources/'tray.ico').write_bytes((assets/'QCUBuddy.ico').read_bytes())
    else:
        for name in ['QCU.icns','icon.icns']:(resources/name).write_bytes((assets/'QCUBuddy.icns').read_bytes())
        infofile=resources.parent/'Info.plist';info=plistlib.loads(infofile.read_bytes())
        # Electron embeds the SHA256 of ASAR's JSON header, not its full payload.
        header_size=struct.unpack('<4I',patched[:16])[3]
        info.update(CFBundleDisplayName='QCU Buddy')
        info['ElectronAsarIntegrity']['Resources/app.asar']['hash']=sha(patched[16:16+header_size])
        infofile.write_bytes(plistlib.dumps(info))
    proof={**previous,'customAsarSha256':sha(patched),'brandBaselineAsarSha256':sha(original),'branding':'QCU Buddy','modifiedAsarMembers':sorted(set(previous.get('modifiedAsarMembers',[]))|set(replacements)),'brandingModifiedMembers':sorted(replacements),'brandingOtherPackedMembersUnchanged':unchanged,'securityFusesChanged':False,'minimumVersionPolicyUnchanged':True,'authAndProviderConfigurationUnchanged':True,'appIdsAndDataPathsUnchanged':True,'internalProductNameAndSecretStorageIdentityUnchanged':True}
    (kit/'support/managed-updates.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
    return proof
