import test from 'node:test'
import assert from 'node:assert/strict'
import {createHomePersonalization} from '../hub/plugins/qcu-branding/src/personalization.mjs'
test('favorites and pins survive restart, preserve order, and unpin never removes favorite',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},store=createHomePersonalization({storage})
 store.favorite('qcu-one');assert.deepEqual(store.snapshot().pinned,[])
 store.pin('qcu-one');store.pin('qcu-two');store.move('qcu-two',-1)
 assert.deepEqual(createHomePersonalization({storage}).snapshot().pinned,['qcu-two','qcu-one'])
 store.pin('qcu-two');assert.ok(store.snapshot().favorites.includes('qcu-two'))
 store.favorite('qcu-one');assert.deepEqual(store.snapshot().pinned,[])
 assert.ok(!JSON.stringify([...data.values()]).includes('prompt'))
})
test('storage failure reports an error and does not claim preferences were saved',()=>{
 const store=createHomePersonalization({storage:{getItem:()=>null,setItem:()=>{throw Error('denied')}}})
 store.pin('qcu-one');assert.deepEqual(store.snapshot().pinned,[]);assert.match(store.snapshot().error,/未能保存/)
})
