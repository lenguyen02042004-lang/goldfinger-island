import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const playerOne = "11111111-1111-4111-8111-111111111111";
const playerTwo = "22222222-2222-4222-8222-222222222222";

await db.exec(`
  create schema auth;
  create role anon;
  create role authenticated;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create publication supabase_realtime;
`);

for (const migration of [
  "supabase/migrations/20260717000000_schema.sql",
  "supabase/migrations/20260717000100_multiplayer.sql",
]) {
  const sql = (await readFile(migration, "utf8"))
    .replace('create extension if not exists "pgcrypto";', "");
  await db.exec(sql);
  console.log(`Applied ${migration}`);
}

await db.query(
  `insert into auth.users (id, email, raw_user_meta_data)
   values
     ($1, 'minh@example.com', '{"full_name":"Minh"}'),
     ($2, 'lan@example.com', '{"full_name":"Lan"}')`,
  [playerOne, playerTwo],
);

async function asPlayer(playerId, sql, params = []) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${playerId}', false)`);
  await db.exec("set role authenticated");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

const firstState = await asPlayer(playerOne, "select public.game_get_state() as state");
const secondState = await asPlayer(playerTwo, "select public.game_get_state() as state");

if (firstState.rows[0].state.me.coin !== 1000 || secondState.rows[0].state.me.coin !== 1000) {
  throw new Error("New players did not receive the starting balance.");
}

const rewardState = await asPlayer(playerOne, "select public.game_claim_daily_reward() as state");
if (rewardState.rows[0].state.me.coin !== 1020) {
  throw new Error("Daily reward RPC did not add 20 coins.");
}

const buildState = await asPlayer(
  playerOne,
  "select public.game_start_build($1) as state",
  [1],
);
if (buildState.rows[0].state.me.coin !== 990) {
  throw new Error("Build RPC did not deduct the server-side cost.");
}

const activeRound = await db.query("select id from public.rounds where status = 'active'");
const roundId = activeRound.rows[0].id;

await db.query(
  `update public.buildings
   set status = 'completed', started_at = null, finishes_at = null, completed_at = now()
   where round_id = $1 and user_id = $2 and slot = 1`,
  [roundId, playerOne],
);
await db.query(
  `update public.buildings
   set status = 'completed', completed_at = now()
   where round_id = $1 and user_id = $2 and slot = 1`,
  [roundId, playerTwo],
);

const shieldState = await asPlayer(
  playerOne,
  "select public.game_shield_building($1) as state",
  [1],
);
if (shieldState.rows[0].state.me.coin !== 988) {
  throw new Error("Building shield RPC did not deduct two coins.");
}

const missileState = await asPlayer(
  playerOne,
  "select public.game_launch_missile($1) as state",
  [playerTwo],
);
if (missileState.rows[0].state.me.coin !== 983 || missileState.rows[0].state.missiles.length !== 1) {
  throw new Error("Missile RPC did not deduct five coins or create a radar entry.");
}

const targetLeak = JSON.stringify(missileState.rows[0].state.missiles).includes("target");
if (targetLeak) {
  throw new Error("Radar payload leaked the target building.");
}

let directCoinWriteBlocked = false;
await db.exec("set role authenticated");
try {
  await db.query("update public.profiles set coin = 999999 where id = $1", [playerOne]);
} catch {
  directCoinWriteBlocked = true;
} finally {
  await db.exec("reset role");
}

if (!directCoinWriteBlocked) {
  throw new Error("Authenticated clients can still update coin directly.");
}

console.log("Authoritative multiplayer migration checks passed.");
await db.close();
