// skill-content.js is generated only by the reviewed deterministic staging script.
import { content } from './skill-content.js'
import { createSkillProvider } from './provider.js'
export const name = 'qcu-study-coach'
export const inject = ['skills']
export const apply = createSkillProvider(content)
