import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {join} from 'node:path'
const require=createRequire(process.env.QCU_OFFICIAL_DEPENDENCIES+'/package.json')
const {boot,readProfilePatches,loadProfileDirectory}=await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-app-boot')))
const [dir,home]=process.argv.slice(2),anchor=join(home,'package.json')
const profile={name:'dsh',dir,patchPath:join(dir,'cordis.patch.yml'),installAnchor:anchor,cwd:home,home,overlays:[],startedBundles:loadProfileDirectory('dsh',dir,anchor).layers.map(l=>l.packageName),telemetryDisabledEnv:undefined}
const ctx=await boot('dsh',join(dir,'cordis.yml'),readProfilePatches('dsh',profile),c=>c.provide('profileContext',profile))
try{console.log('COLD_RESULT:'+JSON.stringify(ctx.get('upgradeProbe')??null))}finally{await ctx.fiber.dispose()}
