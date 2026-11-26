import { changedRecords, recordsFor, restoreRecords } from "./home-cloud.js";

export function createSync({api, initial, change}) {
 let household, base, working, timer, busy, identity, status, cacheKey;
 const empty = initial();
 const message = (value, state) => {
  status = value;
  change({status,connected:Boolean(household),state});
 };
 const cache = () => localStorage.setItem(cacheKey,JSON.stringify({household,base,working}));
 const dirty = () => changedRecords(base,restoreRecords(base,initial),working);
 async function sync() {
  if (!household || busy) return;
  const started = identity;
  busy = true;
  try {
   const submitted = structuredClone(working);
   const changes = dirty();
   if (changes.length) {
    const committed = await api.apply(household,changes);
    if (identity!==started) return;
    const rows = new Map(base.map(row=>[JSON.stringify([row.collection,row.record_id]),row]));
    for (const row of committed) {
     const id=JSON.stringify([row.collection,row.record_id]);
     if(row.payload)rows.set(id,row);
     else rows.delete(id);
    }
    base=[...rows.values()];
    cache();
   }
   const fresh = await api.read(household);
   if (identity!==started) return;
   const recent = changedRecords(base,submitted,working,true);
   const rows = new Map(fresh.map(row=>[JSON.stringify([row.collection,row.record_id]),row]));
   for (const row of recent) {
    const id=JSON.stringify([row.collection,row.record_id]);
    if (row.payload) rows.set(id,row);
    else rows.delete(id);
   }
   base=fresh;
   working=restoreRecords(rows.values(),initial);
   cache();
   message("已同步",working);
   if(recent.length) schedule();
  } catch(error) {
   if (identity!==started) return;
   message(error.code==="40001" ? "有记录在另一台设备上更新。请先导出当前修改，再重新加载云端。" : "同步暂缓，修改已保存在这台设备。");
  } finally { if (identity===started) busy=false; }
 }
 function schedule() {
  clearTimeout(timer);
  timer=setTimeout(sync,250);
 }
 function stop() {
  identity=Symbol();
  household=null;
  busy=false;
  clearTimeout(timer);
 }
 return {
  get connected(){ return Boolean(household); },
  get status(){ return status; },
  async start() {
   stop();
   const started=identity;
   const user=api.user();
   if (!user) return;
   cacheKey="our-little-home-v3-cache:"+user.id;
   const cached=JSON.parse(localStorage.getItem(cacheKey)||"null");
   let households;
   try {households=await api.households();}
   catch(error){
    if(error.status||!cached?.household)throw error;
    households=[cached.household];
   }
   if (identity!==started) return;
   if(households.length!==1) throw new Error("登录成功，但此账号需要关联一个家庭。");
   const selected=households[0];
   try {
    const cachedForHousehold=cached?.household===selected;
    const records=cachedForHousehold?cached.base:await api.read(selected);
    if(identity!==started)return;
    household=selected;
    base=records;
    working=cachedForHousehold?cached.working:restoreRecords(base,initial);
    message("正在同步…",working);
    await sync();
   } catch(error) {
    if(identity===started) stop();
    throw error;
   }
  },
  save(state) {
   working=structuredClone(state);
   cache();
   message("等待同步…");
   schedule();
  },
  importLegacy(legacy, visibility) {
   const existing = new Set(recordsFor(working).map(row=>JSON.stringify([row.collection,row.record_id])));
   const migration = recordsFor(legacy).filter(row=>!existing.has(JSON.stringify([row.collection,row.record_id]))).map(row=>{
    const keepPrivate = row.visibility==="private" ||
     (visibility==="private" && ["items","tasks","finds","shopping","chores","subscriptions","petRecords"].includes(row.collection));
    return keepPrivate ? {...row,visibility:"private",payload:{...row.payload,visibility:"private"}} : row;
   });
   const combined=restoreRecords([...recordsFor(working),...migration],initial);
   this.save(combined);
   return combined;
  },
  async reload() {
   if (!household || busy) return;
   const started=identity;
   busy=true;
   try {
    const fresh=await api.read(household);
    if(identity!==started)return;
    base=fresh;
    working=restoreRecords(fresh,initial);
    cache();
    message("已加载云端数据",working);
   } finally {if(identity===started)busy=false;}
  },
  sync,stop
 };
}
