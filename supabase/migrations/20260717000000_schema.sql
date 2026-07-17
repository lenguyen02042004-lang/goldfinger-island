-- GoldFinger Island production schema.
-- Run this file once in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Island Player',
  avatar_url text,
  coin integer not null default 1000 check (coin >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  round_number bigint generated always as identity unique,
  status text not null default 'active' check (status in ('active', 'finished')),
  winner_id uuid references public.profiles(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create unique index if not exists one_active_round on public.rounds(status) where status = 'active';

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot smallint not null check (slot between 1 and 10),
  building_type text not null,
  status text not null default 'locked' check (status in ('locked', 'ready', 'building', 'completed', 'destroyed')),
  started_at timestamptz,
  finishes_at timestamptz,
  shield_until timestamptz,
  unique (round_id, user_id, slot)
);

create table if not exists public.missiles (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  from_user uuid not null references public.profiles(id),
  to_user uuid not null references public.profiles(id),
  target_slot smallint not null check (target_slot between 1 and 10),
  status text not null default 'flying' check (status in ('flying', 'hit', 'blocked')),
  launched_at timestamptz not null default now(),
  arrives_at timestamptz not null,
  resolved_at timestamptz
);

create table if not exists public.leaderboard (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  wins integer not null default 0 check (wins >= 0),
  best_time_seconds integer check (best_time_seconds > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_rewards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_date date not null default current_date,
  amount integer not null default 20,
  primary key (user_id, reward_date)
);

create table if not exists public.game_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.rounds enable row level security;
alter table public.buildings enable row level security;
alter table public.missiles enable row level security;
alter table public.leaderboard enable row level security;
alter table public.daily_rewards enable row level security;
alter table public.game_snapshots enable row level security;

create policy "profiles readable by authenticated players" on public.profiles for select to authenticated using (true);
create policy "players update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "rounds readable by authenticated players" on public.rounds for select to authenticated using (true);
create policy "buildings readable by authenticated players" on public.buildings for select to authenticated using (true);
create policy "players manage own buildings" on public.buildings for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "players launch own missiles" on public.missiles for insert to authenticated with check (auth.uid() = from_user);
create policy "leaderboard readable by everyone" on public.leaderboard for select using (true);
create policy "players read own rewards" on public.daily_rewards for select to authenticated using (auth.uid() = user_id);
create policy "players read own snapshot" on public.game_snapshots for select to authenticated using (auth.uid() = user_id);
create policy "players insert own snapshot" on public.game_snapshots for insert to authenticated with check (auth.uid() = user_id);
create policy "players update own snapshot" on public.game_snapshots for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'Island Player'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.leaderboard (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Public radar intentionally omits target_slot so defenders cannot inspect the target.
create or replace view public.missile_radar
with (security_invoker = false)
as
select
  m.id,
  m.round_id,
  m.from_user,
  sender.display_name as from_name,
  m.to_user,
  defender.display_name as to_name,
  m.status,
  m.launched_at,
  m.arrives_at,
  m.resolved_at
from public.missiles m
join public.profiles sender on sender.id = m.from_user
join public.profiles defender on defender.id = m.to_user;

revoke select on public.missiles from anon, authenticated;
grant select on public.missile_radar to authenticated;
