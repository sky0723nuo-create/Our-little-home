const project = "https://ctkdtworpiepddzxbdzc.supabase.co";
const publishableKey = "sb_publishable_YNtpU3qVRqYMpy-XD1kZHw_NbACXmK8";
const sessionKey = "our-little-home-v3-session";
export const collections = ["locations","items","history","shopping","chores","wellness","tasks","pets","petRecords","subscriptions","activity","finds"];
const key = row => JSON.stringify([row.collection,row.record_id]);
const safeId = id => typeof id === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(id);

export function recordsFor(state) {
 const records = [];
 for (const collection of collections) {
  for (const record of state[collection] || []) {
   if (!safeId(record?.id)) continue;
   const privateRecord = record.visibility === "private" ||
    ["wellness","history","activity"].includes(collection);
   records.push({collection,record_id:record.id,visibility:privateRecord?"private":"shared",payload:record});
  }
 }
 if (state.floorPlan) records.push({collection:"map",record_id:"floor-plan",visibility:"shared",payload:{image:state.floorPlan}});
 return records;
}

export function restoreRecords(rows, initial) {
 const state = initial();
 for (const row of rows) {
  if (row.collection === "map" && row.record_id === "floor-plan") state.floorPlan = row.payload.image;
  else if (collections.includes(row.collection) && safeId(row.record_id)){
   const payload = {...row.payload,id:row.record_id};
   if (["items","tasks"].includes(row.collection)) payload.visibility = row.visibility;
   state[row.collection].push(payload);
  }
 }
 return state;
}

export function changedRecords(base, before, after, includePendingDeletes=false) {
 const previous = new Map(recordsFor(before).map(row=>[key(row),row]));
 const desired = new Map(recordsFor(after).map(row=>[key(row),row]));
 const remote = new Map(base.map(row=>[key(row),row]));
 const changes = [];
 for (const [id,row] of desired) {
  if (JSON.stringify(previous.get(id)) === JSON.stringify(row)) continue;
  changes.push({...row,revision:remote.get(id)?.revision || null});
 }
 for (const [id,row] of previous) {
  if (!desired.has(id) && (remote.has(id)||includePendingDeletes)) {
   changes.push({collection:row.collection,record_id:row.record_id,revision:remote.get(id)?.revision||null,payload:null});
  }
 }
 return changes;
}

export function createCloud() {
 let session;
 try { session = JSON.parse(sessionStorage.getItem(sessionKey)); } catch {}
 let refreshing;
 let generation = 0;
 function persist(response) {
  session = {...response,expires_at:Math.floor(Date.now()/1000)+response.expires_in};
  sessionStorage.setItem(sessionKey,JSON.stringify(session));
  return session;
 }
 async function request(path, {body,token,signal} = {}) {
  const response = await fetch(project+path,{
   method:body===undefined?"GET":"POST",signal,
   headers:{apikey:publishableKey,...(token?{Authorization:"Bearer "+token}:{}),...(body===undefined?{}:{"Content-Type":"application/json"})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) throw Object.assign(new Error(result?.message||result?.msg||"Supabase request failed"),{code:result?.code,status:response.status});
  return result;
 }
 async function authToken() {
  if (!session) throw new Error("请先登录");
  if (session.expires_at > Date.now()/1000+45) return session.access_token;
  const current = generation;
  refreshing ??= request("/auth/v1/token?grant_type=refresh_token",{body:{refresh_token:session.refresh_token}})
   .then(response=>{
    if (generation!==current) throw new Error("登录已结束");
    return persist(response);
   }).finally(()=>{refreshing=null;});
  return (await refreshing).access_token;
 }
 async function data(path, body) {
  return request("/rest/v1/"+path,{body,token:await authToken(),signal:AbortSignal.timeout(15000)});
 }
 return {
  user:()=>session?.user,
  async signIn(email,password) {
   const current=generation;
   const response=await request("/auth/v1/token?grant_type=password",{body:{email,password}});
   if(generation===current)persist(response);
  },
  async sendLink(email) {
   const redirect = new URL(location.pathname,location.origin);
   await request("/auth/v1/otp?redirect_to="+encodeURIComponent(redirect.href),{body:{email,create_user:false}});
  },
  async finishLink() {
   if (!location.hash) return;
   const hash = new URLSearchParams(location.hash.slice(1));
   const access_token = hash.get("access_token"),refresh_token = hash.get("refresh_token");
   if (!(access_token&&refresh_token) && !hash.has("error")) return;
   history.replaceState(null,"",location.pathname+location.search);
   if (!access_token||!refresh_token) throw new Error("登录链接无效或已过期");
   const user = await request("/auth/v1/user",{token:access_token});
   persist({access_token,refresh_token,user,expires_in:Number(hash.get("expires_in"))||3600});
  },
  forget() {
   const token=session?.access_token;
   if(token)request("/auth/v1/logout?scope=local",{token,body:{}}).catch(()=>{});
   generation++;
   session=null;
   sessionStorage.removeItem(sessionKey);
  },
  households:()=>data("rpc/home_v3_households"),
  async read(household) {
   const rows = [];
   for (let offset=0;;offset+=500) {
    const batch = await data("home_v3_records?household_id=eq."+encodeURIComponent(household)+"&order=collection,record_id&limit=500&offset="+offset);
    rows.push(...batch);
    if (batch.length<500) return rows;
   }
  },
  apply:(household,changes)=>data("rpc/home_v3_apply",{target:household,changes})
 };
}
