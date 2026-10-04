/** Types for the unchanged legacy QCU tool plugin. */
import type { Context } from '@deepseek-ai/cordis'
export const name: string
export const inject: string[]
export function apply(ctx: Context, config: { bridgePath: string; strictMode: true }): () => void
