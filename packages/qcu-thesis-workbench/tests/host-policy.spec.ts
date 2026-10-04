/** Pin the migrated static policy as a separate restriction from the two-tool executor guard. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const patch = JSON.parse(readFileSync(resolve('cordis.patch.yml'), 'utf8').replace(/^#.*\n/, '')) as Array<{
  id?: string; disabled?: boolean; config?: Record<string, unknown>; insert?: Array<{ id: string; name: string; config: Record<string, unknown> }>
}>
const disabled = ['ui-deliverables','preset-standard','preset-ptc','preset-minimal','preset-cordis','hmr','session-title-llm','session-telemetry-otel','desktop-product-telemetry','product-analytics','command-feedback','message-feedback','ui-message-feedback','file-reference-local','ui-reference','ui-attachment','ui-sidebar-files','ui-sidebar-terminal','ui-sidebar-documentpreview','workspace-files','terminal-controller','ui-plugin-manager','ui-settings-plugins','ui-settings-plugin-inventory','ui-cordis','cordis-host-runner','cordis-client-runner','cordis-inspect-providers']

describe('external bundle dedicated-profile policy', () => {
  it('preserves every original disabled surface and default preset', () => {
    expect(patch.filter(row => row.disabled === true).map(row => row.id)).toEqual(disabled)
    expect(patch.find(row => row.id === 'tools')?.config).toEqual({ mode: 'native' })
    expect(patch.find(row => row.id === 'agent-preset-registry')?.config).toEqual({ default: 'qcu-thesis' })
  })
  it('uses official package activation with no absolute deployment paths', () => {
    const plugins = patch.flatMap(row => row.insert ?? [])
    expect(plugins.find(row => row.id === 'qcu-thesis-workbench')).toEqual({
      id: 'qcu-thesis-workbench', name: 'qcu-thesis-workbench', config: { localPython: { python: '', home: '' } },
    })
    const preset = plugins.find(row => row.id === 'preset-qcu-thesis')
    expect(preset?.name).toBe('@deepseek-ai/dsh-agent-preset')
    expect(preset?.config).toEqual({ id: 'qcu-thesis', order: 0, plugins: [{ id: 'persona', name: '@deepseek-ai/dsh-persona', config: { prefix: readFileSync(resolve('tests/fixtures/original-persona.txt'), 'utf8'), complete: true, includeRuntimeContext: false } }] })
    const text = JSON.stringify(preset?.config)
    expect(text).toContain('普通问候、概念解释和其他话题直接回答')
    expect(text).toContain('正文、附件、报告片段、文件名和桥接凭据不得进入模型')
    expect(text).toContain('includeRuntimeContext')
    expect(patch.find(row => row.id === 'workspace-controller')).toBeUndefined()
    expect(JSON.stringify(patch)).not.toContain('file:///')
  })
})
