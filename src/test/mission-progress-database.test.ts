// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";
const uid = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
let cid: string;
beforeAll(async () => {
      db = new PGlite({ extensions: { pg_trgm } });
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema extensions; create schema realtime;
      create table auth.users(id uuid primary key, is_anonymous boolean not null default false);
      create table realtime.messages(id bigint generated always as identity);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      create function realtime.topic() returns text language sql stable as $$ select ''::text $$;
      create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement) returns void language plpgsql as $$ begin return; end $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;`);
    for (const file of readdirSync("drizzle/migrations")
      .filter((name) => name.endsWith(".sql") && !name.startsWith("0075_"))
      .sort()) {
      try {
        await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
      } catch (error) {
        throw new Error(`Migration ${file} failed: ${String(error)}`);
      }
    }

  await db.exec(`insert into auth.users(id) values('${uid}'),('${other}');
    insert into profiles(id) values('${uid}'),('${other}');
    insert into characters(user_id,name,gender,age,personality) values('${uid}','Ade','male',21,'ambitious');
    insert into wallets(user_id,character_id) select user_id,id from characters;
    insert into player_missions(user_id,character_id,mission_id) select c.user_id,c.id,m.id from characters c cross join missions m;`);
  cid=(await db.query<{id:string}>("select id from characters where user_id=$1",[uid])).rows[0]!.id;
  await db.exec(readFileSync("supabase/migrations/20261029072109_mission_career_progress.sql","utf8"));
},180_000);
afterAll(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec(`begin; select set_config('test.user_id','${uid}',false);`);});
afterEach(async()=>{await db.exec("rollback; reset role;");});
async function progress() { return (await db.query<{progress:number,status:string}>("select pm.progress,pm.status from player_missions pm join missions m on m.id=pm.mission_id where m.slug='earn_10000' and pm.character_id=$1",[cid])).rows[0]!; }
async function credit(amount:number,category:string){await db.query("select public._credit($1,$2,$3,'Test pay')",[cid,amount,category]);}
async function claim(slug='earn_10000'){ return db.query("select claim_mission((select pm.id from player_missions pm join missions m on m.id=pm.mission_id where m.slug=$1 and pm.character_id=$2)) value",[slug,cid]); }
async function reject(run:()=>Promise<unknown>,message:string){await db.exec('savepoint expected_error');await expect(run()).rejects.toThrow(message);await db.exec('rollback to savepoint expected_error');}
it('counts career and legacy earnings without unrelated income',async()=>{
  await credit(3500,'career_shift'); await credit(1500,'job'); await credit(9000,'mission_reward'); await credit(9000,'stall_income');
  await db.query('select _recalc_missions($1)',[cid]);
  expect(await progress()).toEqual({progress:5000,status:'in_progress'});
});
it('claims existing rewards once and does not count its own payout',async()=>{
  await credit(10000,'career_shift');
  const before=(await db.query<{balance:number}>("select balance from wallets where character_id=$1",[cid])).rows[0]!.balance;
  await claim();
  expect(await progress()).toEqual({progress:10000,status:'claimed'});
  expect((await db.query<{balance:number}>("select balance from wallets where character_id=$1",[cid])).rows[0]!.balance).toBe(Number(before)+2000);
  await reject(()=>claim(),'already claimed');
  expect((await db.query("select * from transactions where category='mission_reward'")).rows).toHaveLength(1);
  expect((await db.query<{xp:number}>("select xp from characters where id=$1",[cid])).rows[0]!.xp).toBe(40);
});
it('rejects below-target, foreign and missing-character claims',async()=>{
  await reject(()=>claim(),'not ready');
  await credit(10000,'career_shift');
  await db.exec(`insert into characters(user_id,name,gender,age,personality) values('${other}','Bisi','female',21,'creative'); select set_config('test.user_id','${other}',false);`);
  await reject(()=>claim(),'not found');
  await db.exec(`delete from characters where user_id='${other}';`);
  await reject(()=>claim(),'create a character');
  await db.exec("select set_config('test.user_id','',false)");
  await reject(()=>claim(),'Sign in');
});
it('denies direct progress writes and private mission discovery',async()=>{
  await db.exec('set local role authenticated');
  await reject(()=>db.exec('update player_missions set progress=10000'), 'permission');
  await reject(()=>db.exec("update player_missions set status='claimed'"),'permission');
  await reject(()=>db.query('select _recalc_missions($1)',[cid]),'permission');
  await db.exec(`select set_config('test.user_id','${other}',false)`);
  expect((await db.query('select * from player_missions')).rows).toHaveLength(0);
  await db.exec('reset role; set local role anon');
  await reject(()=>db.query("select claim_mission($1)",[crypto.randomUUID()]),'permission');
});
it('rolls back status and wallet when XP awarding fails',async()=>{
  await credit(10000,'career_shift');
  await db.exec(`create function test_fail_xp() returns trigger language plpgsql as $$ begin if new.xp>old.xp then raise exception 'test XP failure'; end if; return new; end $$;
    create trigger fail_xp before update on characters for each row execute function test_fail_xp();`);
  await reject(()=>claim(),'test XP failure');
  expect(await progress()).toEqual({progress:0,status:'in_progress'});
  expect((await db.query('select * from transactions where category=\'mission_reward\'')).rows).toHaveLength(0);
  expect(Number((await db.query<{balance:number}>('select balance from wallets where character_id=$1',[cid])).rows[0]!.balance)).toBe(10000);
});
it('backfills unfinished earnings without rewards or resetting resolved goals',async()=>{
  await credit(12000,'career_shift');
  await db.exec("update player_missions set status='claimed',progress=1 where mission_id=(select id from missions where slug='first_job')");
  const before=await db.query('select balance from wallets');
  await db.exec(readFileSync('supabase/migrations/20261029072109_mission_career_progress.sql','utf8'));
  expect(await progress()).toEqual({progress:10000,status:'completed'});
  expect(await db.query('select balance from wallets')).toMatchObject({rows:before.rows});
  expect((await db.query('select * from transactions where category=\'mission_reward\'')).rows).toHaveLength(0);
  expect((await db.query("select status,progress from player_missions where mission_id=(select id from missions where slug='first_job')")).rows[0]).toEqual({status:'claimed',progress:1});
});
it('preserves completed state and sends one completion notice across recalculations',async()=>{
  await credit(10000,'career_shift');
  await db.query('select _recalc_missions($1)',[cid]);
  await db.query('select _recalc_missions($1)',[cid]);
  expect((await db.query("select * from notifications where title like 'Mission complete: Earn%'")).rows).toHaveLength(1);
  await db.exec("delete from transactions where category='career_shift'");
  await db.query('select _recalc_missions($1)',[cid]);
  expect(await progress()).toEqual({progress:10000,status:'completed'});
});
