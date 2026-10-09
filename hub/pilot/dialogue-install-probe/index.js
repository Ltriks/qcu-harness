/** Synthetic in-memory marker only: no filesystem, network, tools or child processes. */
export const name = 'qcu-dialogue-install-probe'
export const inject = ['skills']
export function apply(ctx, config) {
  if (config?.enabled === false) return
  if (config?.enabled !== true) throw new Error('The synthetic probe requires explicit activation.')
  ctx.skills.register({
    name: 'qcu-dialogue-install-probe',
    description: 'Internal synthetic installation marker; no file or network actions.',
    source: 'synthetic-dialogue-install-probe',
    content: '# Synthetic installation marker\n\nQCU_INSTALL_PROBE_TEST_1\n\nThis is a synthetic test marker. Reply with the marker only. Do not read files, execute tools, upload data or request permissions.\n',
  })
}

