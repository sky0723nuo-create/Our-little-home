import test from "node:test";
import assert from "node:assert/strict";
import { createSync } from "../cloud-sync.js";
import { collections, changedRecords, recordsFor, restoreRecords } from "../home-cloud.js";

const initial = () => Object.fromEntries(collections.map(name=>[name,[]]));

test("migration imports legacy data once without changing the local backup",async()=>{
 const saved = new Map();
 globalThis.localStorage={
  getItem:key=>saved.get(key)??null,
  setItem:(key,value)=>saved.set(key,value)
 };
 let remote=[];
 const api={
  user:()=>({id:"test"}),
  households:async()=>["house-a"],
  read:async()=>structuredClone(remote),
  apply:async(_house,changes)=>{
   const committed=changes.map((row,i)=>({...row,revision:"saved-"+i}));
   remote.push(...committed);
   return committed;
  }
 };
 const sync=createSync({api,initial,change:()=>{}});
 await sync.start();
 const legacy=initial();
 legacy.locations.push({id:"room",name:"Test room"});
 legacy.items.push({id:"item",name:"Tape",locationId:"room",quantity:2});
 legacy.tasks.push({id:"task",name:"Renew",visibility:"private",owner:"me"});
 legacy.history.push({id:"history",itemId:"item",name:"Tape"});
 const result=sync.importLegacy(legacy,"shared");
 await sync.sync();
 sync.importLegacy(legacy,"shared");
 await sync.sync();
 sync.stop();
 assert.equal(result.items[0].locationId,"room");
 assert.deepEqual(remote.map(row=>[row.collection,row.visibility]),[
  ["locations","shared"],["items","shared"],["history","private"],["tasks","private"]
 ]);
 assert.equal(legacy.items[0].visibility,undefined);
});

test("private records and unsynced deletes keep their correct mutation scope",()=>{
 const before=initial();
 before.items.push({id:"x",name:"Tape",visibility:"private",quantity:1});
 const base=[{...recordsFor(before)[0],revision:"old"}];
 const after=restoreRecords(base,initial);
 after.items[0].quantity=2;
 const [update]=changedRecords(base,before,after);
 assert.equal(update.visibility,"private");
 assert.equal(update.revision,"old");
 assert.equal(update.payload.quantity,2);
 assert.deepEqual(changedRecords([],before,initial(),true),[
  {collection:"items",record_id:"x",revision:null,payload:null}
 ]);
});
