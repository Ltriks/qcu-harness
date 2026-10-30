import {check, exact, text, searchTerms} from './protocol.mjs'

export const SHELF_LIMITS = Object.freeze({title:180, course:80, tags:8, tag:24, hits:40, chunkBytes:262144, backupBytes:8001024})
export const emptyMetadata = () => ({title:'', course:'', tags:[], favorite:false})
export function shelfText(value, max) {
  text(value, max, false)
  check(!/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value), 'invalid-text')
  return value.trim().normalize('NFC')
}
export function parseMetadata(raw) {
  exact(raw, ['title', 'course', 'tags', 'favorite'])
  const title = shelfText(raw.title, SHELF_LIMITS.title), course = shelfText(raw.course, SHELF_LIMITS.course)
  check(Array.isArray(raw.tags) && raw.tags.length <= SHELF_LIMITS.tags && typeof raw.favorite === 'boolean', 'invalid-fields')
  const tags = [], seen = new Set()
  for (const value of raw.tags) {
    const tag = shelfText(value, SHELF_LIMITS.tag), key = tag.toLowerCase()
    check(tag, 'invalid-text')
    if (!seen.has(key)) { tags.push(tag); seen.add(key) }
  }
  return {title, course, tags, favorite:raw.favorite}
}
export function metadataFor(library, id) { return Object.hasOwn(library.documents, id) ? library.documents[id] : emptyMetadata() }
export function validateLibrary(library, documents, notes) {
  exact(library, ['documents', 'notes'])
  for (const [kind, known, max] of [['documents', documents, 24], ['notes', notes, 200]]) {
    const values = library[kind]
    check(values && typeof values === 'object' && !Array.isArray(values) && Object.keys(values).length <= max, 'invalid-store')
    for (const id of Object.keys(values)) {
      check(known.has(id) && !['__proto__', 'constructor', 'prototype'].includes(id), 'invalid-store')
      if (kind === 'documents') check(JSON.stringify(parseMetadata(values[id])) === JSON.stringify(values[id]), 'invalid-store')
      else check(typeof values[id] === 'boolean', 'invalid-store')
    }
  }
}
export function parseShelf(raw) {
  exact(raw, ['query', 'course', 'tag', 'favorites'])
  const query = shelfText(raw.query, 2000), course = shelfText(raw.course, 80), tag = shelfText(raw.tag, 24)
  check(typeof raw.favorites === 'boolean', 'invalid-fields')
  return {query, course, tag, favorites:raw.favorites}
}
export function matchesFilters(meta, filters) {
  return (!filters.course || meta.course === filters.course) && (!filters.tag || meta.tags.includes(filters.tag)) && (!filters.favorites || meta.favorite)
}
export function matchesMetadata(document, meta, query) {
  const terms = searchTerms(query), value = [document.name, meta.title, meta.course, ...meta.tags].join(' ').toLowerCase()
  return terms.some(term => value.includes(term))
}
