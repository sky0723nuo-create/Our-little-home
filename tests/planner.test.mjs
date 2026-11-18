import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const source=await readFile(new URL("../planner-v2.js",import.meta.url),"utf8");
const {createPlanner}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const seed=()=>({items:[],locations:[],tasks:[],pets:[],petRecords:[],subscriptions:[],chores:[],wellness:[],history:[]});
let counter=0;
function setup(more={}){
 const state={...seed(),...more},messages=[];
 const app=createPlanner({getState:()=>state,save:()=>{},esc:s=>String(s??""),toast:s=>messages.push(s),uuid:()=>("id-"+(++counter)),icon:()=>"<svg/>"});
 return {app,state,messages};
}
const oldFormData=globalThis.FormData,oldDocument=globalThis.document,oldConfirm=globalThis.confirm;
globalThis.FormData=class{constructor(e){this.data=e.fields;}get(k){return this.data[k]??null;}has(k){return Object.hasOwn(this.data,k);}};
globalThis.document={getElementById:()=>({remove(){},insertAdjacentHTML(){}})};
globalThis.confirm=()=>true;
function send(app,id,fields){return app.submit({target:{id,fields},preventDefault(){}});}
test("legacy storage and routine pages still render",()=>{
 const {app}=setup({items:[{id:"a",name:"Cat Food",quantity:3}],chores:[{name:"Washer",lastDone:"2026-10-18",intervalCount:3,intervalUnit:"months"}]});
 assert.match(app.inventoryPage(),/Inventory/);
 assert.match(app.plannerPage(),/Life Admin/);
 assert.match(app.upcomingWidget(),/Upcoming/);
});
test("task creation preserves optional association and recurrence",()=>{
 const {app,state}=setup({items:[{id:"item-1",name:"Washer",quantity:1}]});
 app.open("task");
 send(app,"v2-task-form",{name:"Clean washer",due:"2026-11-18",owner:"together",visibility:"shared",category:"care",priority:"normal",repeat:"on",every:"3",unit:"months",repeatMode:"after",link:"item:item-1",notes:""});
 assert.equal(state.tasks.length,1);
 assert.equal(state.tasks[0].linkId,"item-1");
 assert.equal(state.tasks[0].repeat,true);
});
test("private tasks cannot be assigned to Jason",()=>{
 const {app,state}=setup();
 app.open("task");
 send(app,"v2-task-form",{name:"Secret",owner:"jason",visibility:"private",category:"admin",priority:"normal",every:"1",unit:"weeks",repeatMode:"after"});
 assert.equal(state.tasks.length,0);
});
test("cat profiles and bath record stay associated",()=>{
 const {app,state}=setup();
 app.open("pet");
 send(app,"v2-pet-form",{name:"Cat A",birthday:"2023-03-01",sex:"female",notes:"",microchip:""});
 app.open("pet");
 send(app,"v2-pet-form",{name:"Cat B",birthday:"2022-04-02",sex:"male",notes:"",microchip:""});
 assert.equal(state.pets.length,2);
 app.open("pet-record","",state.pets[0].id);
 send(app,"v2-pet-record-form",{type:"bath",date:"2026-11-18",nextDate:"",weight:"",notes:""});
 assert.equal(state.petRecords[0].petId,state.pets[0].id);
});
test("receipt increments inventory once and advances delivery date",()=>{
 const {app,state}=setup({items:[{id:"food",name:"Food",quantity:3},{id:"litter",name:"Litter",quantity:6}]});
 app.open("sub");
 send(app,"v2-sub-form",{name:"Food",vendor:"",itemId:"food",quantity:"2",unitName:"bags",every:"4",unit:"weeks",nextDate:"2026-11-18",status:"active"});
 const id=state.subscriptions[0].id;
 app.open("receive",id);
 send(app,"v2-receive-form",{receivedDate:"2026-11-18",quantity:"2"});
 assert.equal(state.items[0].quantity,5);
 assert.equal(state.items[1].quantity,6);
 assert.equal(state.subscriptions[0].nextDate,"2026-12-16");
 app.open("receive",id);
 send(app,"v2-receive-form",{receivedDate:"2026-11-18",quantity:"2"});
 assert.equal(state.items[0].quantity,5);
 assert.equal(state.subscriptions[0].history.length,1);
});
test("deleted tasks can be restored",()=>{
 const {app,state}=setup({tasks:[{id:"t",name:"Task",owner:"me",category:"admin",repeat:false,done:false}]});
 const event=(type,id)=>({target:{closest:()=>({dataset:{v2:type,id}})}});
 app.click(event("delete-task","t"));
 assert.ok(state.tasks[0].deletedAt);
 app.click(event("restore","tasks|t"));
 assert.equal(state.tasks[0].deletedAt,undefined);
});
test.after(()=>{globalThis.FormData=oldFormData;globalThis.document=oldDocument;globalThis.confirm=oldConfirm;});
