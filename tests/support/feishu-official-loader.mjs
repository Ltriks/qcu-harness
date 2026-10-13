import { pathToFileURL } from 'node:url'
import { resolve as pathResolve } from 'node:path'
const root = process.env.QCU_OFFICIAL_DEPENDENCIES
if (!root) throw new Error('Set QCU_OFFICIAL_DEPENDENCIES to the existing audited source tree')
export async function resolve(specifier, context, next) {
  // Configuration tests must use exact ASAR app-boot, never the historical patched source build.
  if (specifier === '@deepseek-ai/dsh-app-boot' && process.env.QCU_FEISHU_OFFICIAL_APP_BOOT)
    return next(pathToFileURL(pathResolve(process.env.QCU_FEISHU_OFFICIAL_APP_BOOT)).href, context)
  try { return await next(specifier, context) }
  catch (error) {
    if (!specifier.startsWith('@deepseek-ai/')) throw error
    return next(specifier, { ...context, parentURL: pathToFileURL(root + '/package.json').href })
  }
}
