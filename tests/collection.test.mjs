import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const source=await readFile(new URL("../collection.js",import.meta.url),"utf8");
const {createCollection}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
let n=0;const oldFormData=globalThis.FormData,oldDoc=globalThis.document;
globalThis.FormData=class{constructor(el){this.data=el.fields;}get(k){return this.data[k]??null;}has(k){return Object.hasOwn(this.data,k);}};
globalThis.document={getElementById:()=>({remove(){},insertAdjacentHTML(){}})};
function setup(initial={}){
 const store={items:[],shopping:[],finds:[],...initial},msgs=[];
 const app=createCollection({getState:()=>store,save:()=>{},esc:v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])),toast:v=>msgs.push(v),uuid:()=>String(++n)});
 return {store,app,msgs};
}
async function submit(app,id,fields){assert.equal(app.submit({target:{id,fields},preventDefault(){}}),true);await new Promise(r=>setImmediate(r));}
test("empty page + unsupported forms are not intercepted",()=>{
 const {app}=setup();assert.match(app.page(),/Our Finds/);
 assert.equal(app.submit({target:{id:"item-form"}}),false);
});
test("create find, optional ratings and history stay independent",async()=>{
 const {app,store}=setup();
 app.open("find");await submit(app,"find-form",{name:"Mochi",type:"product",brand:"",shop:"",location:"",link:"",price:"6.50",notes:"nice",revisit:"yes",rating_together:"4",rating_me:"5",rating_jason:"3",itemId:""});
 assert.equal(store.finds.length,1);assert.deepEqual(store.finds[0].ratings,{together:4,me:5,jason:3});
 const id=store.finds[0].id;
 app.open("experience",id);await submit(app,"find-experience-form",{date:"2026-11-18",place:"Supermarket",price:"6.50",notes:"Nice",rating_together:"3",rating_me:"4",rating_jason:"2"});
 assert.equal(store.finds[0].events.length,1);
 assert.equal(store.finds[0].events[0].ratings.together,3);
 assert.equal(store.finds[0].ratings.together,4,"historical rating must not overwrite current rating");
 assert.match(app.page(),/Mochi/);
});
test("venue preserves dishes and independent individual scores",async()=>{
 const {app,store}=setup();
 app.open("find");await submit(app,"find-form",{name:"Cafe Example",type:"cafe",brand:"",shop:"",location:"Sydney",link:"",price:"",notes:"",rating_together:"",rating_me:"",rating_jason:""});
 const id=store.finds[0].id;
 app.open("experience",id);await submit(app,"find-experience-form",{date:"2026-11-18",place:"Lunch",orders:"Matcha Latte — quite bitter",price:"",notes:"",rating_me:"5",rating_jason:"2",rating_together:""});
 assert.equal(store.finds[0].events[0].orders,"Matcha Latte — quite bitter");
 assert.equal(store.finds[0].events[0].ratings.together,null);
});
test("re-buy uses existing shopping schema and deduplicates",async()=>{
 const {app,store}=setup();
 app.open("find");await submit(app,"find-form",{name:"Good Shampoo",type:"product",brand:"",shop:"",location:"",link:"",price:"14",notes:"",rating_together:"",rating_me:"",rating_jason:""});
 const id=store.finds[0].id;
 const click={target:{closest:()=>({dataset:{find:"rebuy",id}})}};
 app.click(click);app.click(click);
 assert.equal(store.shopping.length,1);
 assert.equal(store.shopping[0].group,"groceries");
 assert.equal(store.shopping[0].budget,14);
});
test("private browser-only state does not remove legacy collections",()=>{
 const {app,store}=setup({items:[{id:"i",name:"Tea"}],shopping:[{id:"s",name:"Milk",group:"groceries"}]});
 assert.equal(store.items.length,1);assert.equal(store.shopping.length,1);assert.match(app.page(),/Our Finds/);
});
test.after(()=>{globalThis.FormData=oldFormData;globalThis.document=oldDoc;});
