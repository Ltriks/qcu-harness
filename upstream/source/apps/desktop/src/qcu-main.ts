/** Independent QCU Office Electron entry; every cold start selects dedicated mode before Desktop loads. */

import { app } from 'electron'
import { configureQcuOfficeEntry } from './qcu-office-entry.ts'

configureQcuOfficeEntry(app, process.env)
await import('./main.ts')
