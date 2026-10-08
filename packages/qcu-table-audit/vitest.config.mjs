import { resolve } from 'node:path'
const upstream = process.env.QCU_TEST_UPSTREAM
if (!upstream) throw new Error('Set QCU_TEST_UPSTREAM to the matching built official checkout')
export default {
  resolve: { alias: [{ find: '../../../upstream/source/apps/desktop-host/src/qcu-policy.ts',
    replacement: resolve(upstream, 'apps/desktop-host/lib/types/qcu-policy.js') }] },
  test: { include: ['tests/*.spec.ts', 'tests/*.spec.mjs'], testTimeout: 15000, hookTimeout: 15000 },
}
