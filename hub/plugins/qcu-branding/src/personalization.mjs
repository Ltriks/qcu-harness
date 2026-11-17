// Personal shortcuts contain stable capability IDs only, never prompts or conversations.
export function createHomePersonalization({storage}={}) {
 const key='qcu.home.personalization.v1',listeners=new Set()
 const ids=value=>Array.isArray(value)?[...new Set(value.filter(id=>typeof id==='string'&&/^qcu-[a-z0-9-]{1,96}$/.test(id)))].slice(0,100):[]
 let saved={};try{storage??=globalThis.localStorage;const raw=storage?.getItem(key);if(raw&&raw.length<24000){const v=JSON.parse(raw);if(v.schema===1)saved=v}}catch{}
 const favorites=ids(saved.favorites)
 let snapshot={favorites,pinned:ids(saved.pinned).filter(id=>favorites.includes(id)),error:''}
 function change(next){try{if(!storage)throw Error('storage unavailable');storage.setItem(key,JSON.stringify({schema:1,favorites:next.favorites,pinned:next.pinned}));snapshot={...next,error:''}}catch{snapshot={...snapshot,error:'未能保存常用设置，请检查本机存储后重试。'}}for(const fn of listeners)fn()}
 return {snapshot:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},favorite(id){if(!ids([id]).length)return;const removing=snapshot.favorites.includes(id);change({...snapshot,favorites:removing?snapshot.favorites.filter(x=>x!==id):[...snapshot.favorites,id],pinned:removing?snapshot.pinned.filter(x=>x!==id):snapshot.pinned})},pin(id){if(!ids([id]).length)return;change({...snapshot,favorites:ids([...snapshot.favorites,id]),pinned:snapshot.pinned.includes(id)?snapshot.pinned.filter(x=>x!==id):ids([...snapshot.pinned,id])})},move(id,direction){const pinned=[...snapshot.pinned],index=pinned.indexOf(id),next=index+direction;if(index<0||next<0||next>=pinned.length)return;[pinned[index],pinned[next]]=[pinned[next],pinned[index]];change({...snapshot,pinned})},dispose(){listeners.clear()}}
}
