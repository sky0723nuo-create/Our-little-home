import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const db = new PGlite();
const household = "10000000-0000-4000-8000-000000000000";
const owner = "20000000-0000-4000-8000-000000000001";
const partner = "20000000-0000-4000-8000-000000000002";
const stranger = "20000000-0000-4000-8000-000000000003";
await db.exec(`
 create role anon;
 create role authenticated;
 create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as
 $$ select nullif(current_setting('test.user',true),'')::uuid $$;
 grant usage on schema auth to anon, authenticated;
 create table households(id uuid primary key);
 create table household_members(household_id uuid, user_id uuid);
 insert into auth.users values ('${owner}'), ('${partner}'), ('${stranger}');
 insert into households values ('${household}');
 insert into household_members values ('${household}', '${owner}'), ('${household}', '${partner}');
`);
const migration = await readFile(new URL("../supabase/home-v3.sql",import.meta.url),"utf8");
await db.exec(migration);
await db.exec(migration);

async function signIn(id) {
 await db.exec("set role authenticated");
 await db.query("select set_config('test.user',$1,false)",[id]);
}
const list = async () => (await db.query("select record_id,revision from home_v3_records order by record_id")).rows;
const apply = (...changes) => db.query("select home_v3_apply($1,$2)",[household,JSON.stringify(changes)]);
const item = (record_id,visibility="shared") => ({collection:"items",record_id,visibility,payload:{name:record_id}});

await signIn(owner);
await apply(item("shared"),item("private","private"));
const [privateRow,sharedRow]=await list();
assert.equal(privateRow.record_id,"private");
await signIn(partner);
assert.deepEqual((await list()).map(row=>row.record_id),["shared"]);
await assert.rejects(apply(item("should_rollback"),{...item("private"),revision:privateRow.revision}),{code:"40001"});
assert.deepEqual((await list()).map(row=>row.record_id),["shared"]);
await assert.rejects(apply({...item("shared","private"),revision:sharedRow.revision}),{code:"42501"});
await apply({...item("shared"),revision:sharedRow.revision,payload:{name:"edited"}});
await assert.rejects(apply({...item("shared"),revision:sharedRow.revision}),{code:"40001"});
await signIn(owner);
assert.equal((await list()).length,2);
await signIn(stranger);
assert.deepEqual(await list(),[]);
assert.deepEqual((await db.query("select * from home_v3_households()")).rows,[]);
await assert.rejects(apply(item("outsider")),{code:"42501"});
await db.exec("set role anon");
await assert.rejects(list(),{code:"42501"});
await assert.rejects(apply(item("anonymous")),{code:"42501"});
await db.close();
console.log("HOME V3 permissions passed");
