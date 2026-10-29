import {Worker} from 'node:worker_threads'
import {check, LIMITS} from './protocol.mjs'

// Process-wide cap; each store also admits only one import. No unbounded waiting queue.
const workers = new Set()
export const parserActivity = () => workers.size
export async function parseBinary(bytes, format, {signal, progress = () => {}, milliseconds = LIMITS.parseMilliseconds, workerURL = new URL('./parser-worker.mjs', import.meta.url)} = {}) {
  check(!signal?.aborted, 'parse-cancelled'); check(workers.size < 2, 'parse-busy')
  check(bytes.length > 0 && bytes.length <= LIMITS.binaryBytes, 'binary-too-large')
  const data = Uint8Array.from(bytes)
  const worker = new Worker(workerURL, {workerData:{data, format}, transferList:[data.buffer], resourceLimits:{maxOldGenerationSizeMb:128, maxYoungGenerationSizeMb:16, stackSizeMb:4}, execArgv:[]})
  workers.add(worker)
  let timer, abort, onMessage, onError, onExit
  try {
    return await new Promise((resolve, reject) => {
      const fail = code => reject(Object.assign(Error(code), {code}))
      abort = () => fail('parse-cancelled')
      signal?.addEventListener('abort', abort, {once:true}); if (signal?.aborted) abort()
      timer = setTimeout(() => fail('parse-timeout'), milliseconds)
      onMessage = msg => {
        if (msg?.progress) {
          if (['opening', 'pdf', 'docx'].includes(msg.progress.stage) && Number.isInteger(msg.progress.done) && msg.progress.done >= 0 && msg.progress.done <= LIMITS.zipEntries) progress(msg.progress)
          return
        }
        if (msg?.error) return fail(['invalid-pdf', 'encrypted-pdf', 'ocr-needed', 'pdf-encoding', 'invalid-docx', 'unsafe-docx', 'empty-docx', 'parse-limit'].includes(msg.error) ? msg.error : 'parse-worker-failed')
        if (JSON.stringify(msg).length > LIMITS.extractedBytes * 6) return fail('parse-limit')
        resolve(msg)
      }
      onError = () => fail('parse-worker-failed')
      onExit = () => fail('parse-worker-failed')
      worker.on('message', onMessage); worker.once('error', onError); worker.once('exit', onExit)
    })
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort)
    // Termination and removal complete before the caller can persist or reuse a slot.
    await worker.terminate()
    worker.off('message', onMessage); worker.off('error', onError); worker.off('exit', onExit); workers.delete(worker)
  }
}
