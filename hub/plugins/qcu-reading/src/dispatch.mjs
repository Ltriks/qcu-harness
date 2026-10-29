import {exact, check} from './protocol.mjs'
// Shared by the official remote and the loopback synthetic preview.
export async function dispatchStore(store, request, signal) {
  const fields = {
    catalog:[], document:['documentId'], import:['file'], search:['documentId', 'query'], note:['note'],
    prepare:['documentId', 'question'], dismiss:['intentId'],
    start:['intentId', 'requestId', 'consent', 'documentId', 'question', 'digest'],
    run:['runId'], cancel:['runId'], export:['runId']
  }
  check(Object.hasOwn(fields, request.action), 'invalid-fields')
  exact(request, ['action', 'workspaceId', ...fields[request.action]])
  const {action, workspaceId, ...data} = request
  if (action === 'catalog') return store.snapshot()
  if (action === 'document') return store.document(data.documentId)
  if (action === 'import') return store.importDocument(data.file)
  if (action === 'search') return store.search(data.documentId, data.query)
  if (action === 'note') return store.saveNote(data.note)
  if (action === 'prepare') return store.prepare(data, signal)
  if (action === 'dismiss') return store.dismiss(data.intentId)
  if (action === 'start') return store.start(data, signal)
  if (action === 'run') return store.run(data.runId)
  if (action === 'cancel') return store.cancel(data.runId)
  if (action === 'export') return {filename:'qcu-reading-' + store.run(data.runId).id + '.md', markdown:store.export(data.runId)}
}
