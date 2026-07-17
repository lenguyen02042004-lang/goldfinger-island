-- Persistent game rooms, private room leaderboards, and admission controls.
-- Rooms contain at most 12 equal players. The creator only manages admission.

begin;

create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and char_length(code) between 6 and 10),
  name text not null check (char_length(name) between 3 and 40),
  created_by uuid not null references public.profiles(id) on delete restrict,
  join_policy text not null default 'open' check (join_policy in ('open', 'approval')),
  created_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.room_join_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (room_id, user_id)
);

create table if not exists public.room_player_state (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  coin integer not null default 1000 check (coin >= 0),
  island_shield_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.room_leaderboard (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  wins integer not null default 0 check (wins >= 0),
  best_time_seconds integer check (best_time_seconds > 0),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.room_daily_rewards (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_date date not null default current_date,
  amount integer not null default 20,
  primary key (room_id, user_id, reward_date)
);

alter table public.profiles add column if not exists active_room_id uuid references public.game_rooms(id) on delete set null;
alter table public.rounds add column if not exists room_id uuid references public.game_rooms(id) on delete cascade;

drop index if exists public.one_active_round;
create unique index if not exists one_active_round_per_room
  on public.rounds(room_id) where status = 'active';

create index if not exists room_join_requests_owner_idx
  on public.room_join_requests(room_id, status, created_at);

alter table public.game_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_join_requests enable row level security;
alter table public.room_player_state enable row level security;
alter table public.room_leaderboard enable row level security;
alter table public.room_daily_rewards enable row level security;

revoke all on public.game_rooms from anon, authenticated;
revoke all on public.room_members from anon, authenticated;
revoke all on public.room_join_requests from anon, authenticated;
revoke all on public.room_player_state from anon, authenticated;
revoke all on public.room_leaderboard from anon, authenticated;
revoke all on public.room_daily_rewards from anon, authenticated;

create policy "room creators read join requests"
  on public.room_join_requests for select to authenticated
  using (exists (
    select 1 from public.game_rooms room
    where room.id = room_join_requests.room_id and room.created_by = auth.uid()
  ));
grant select on public.room_join_requests to authenticated;

-- Preserve an existing global game as a permanent legacy room.
do $$
declare
  v_owner uuid;
  v_room uuid;
begin
  if exists (select 1 from public.rounds where room_id is null) then
    select id into v_owner from public.profiles order by created_at limit 1;
    if v_owner is not null then
      insert into public.game_rooms (code, name, created_by, join_policy)
      values ('LEGACY', 'Phòng GoldFinger đầu tiên', v_owner, 'open')
      on conflict (code) do update set name = excluded.name
      returning id into v_room;

      insert into public.room_members (room_id, user_id)
      select distinct v_room, user_id from public.round_players
      on conflict do nothing;

      insert into public.room_members (room_id, user_id)
      values (v_room, v_owner)
      on conflict do nothing;

      insert into public.room_player_state (room_id, user_id, coin, island_shield_until)
      select v_room, member.user_id, profile.coin, profile.island_shield_until
      from public.room_members member
      join public.profiles profile on profile.id = member.user_id
      where member.room_id = v_room
      on conflict do nothing;

      insert into public.room_leaderboard (room_id, user_id, wins, best_time_seconds)
      select v_room, member.user_id, coalesce(board.wins, 0), board.best_time_seconds
      from public.room_members member
      left join public.leaderboard board on board.user_id = member.user_id
      where member.room_id = v_room
      on conflict do nothing;

      update public.rounds set room_id = v_room where room_id is null;
      update public.profiles profile
      set active_room_id = v_room
      where exists (
        select 1 from public.room_members member
        where member.room_id = v_room and member.user_id = profile.id
      );
    end if;
  end if;
end;
$$;

create or replace function public._game_ensure_profile()
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_name text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'Bạn cần đăng nhập để chơi online.';
  end if;

  select email, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1), 'Island Player')
  into v_email, v_name
  from auth.users
  where id = v_user_id;

  insert into public.profiles (id, display_name)
  values (v_user_id, coalesce(v_name, v_email, 'Island Player'))
  on conflict (id) do nothing;

  return v_user_id;
end;
$$;

create or replace function public._game_active_round(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_round_id uuid;
begin
  select id into v_round_id
  from public.rounds
  where room_id = p_room_id and status = 'active'
  order by started_at
  limit 1;

  if v_round_id is null then
    begin
      insert into public.rounds (room_id, status)
      values (p_room_id, 'active')
      returning id into v_round_id;
    exception when unique_violation then
      select id into v_round_id
      from public.rounds
      where room_id = p_room_id and status = 'active'
      order by started_at
      limit 1;
    end;
  end if;

  return v_round_id;
end;
$$;

create or replace function public._game_seed_player(p_room_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_round_id uuid;
begin
  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'Bạn chưa tham gia phòng này.';
  end if;

  insert into public.room_player_state (room_id, user_id)
  values (p_room_id, p_user_id)
  on conflict do nothing;

  insert into public.room_leaderboard (room_id, user_id)
  values (p_room_id, p_user_id)
  on conflict do nothing;

  v_round_id := public._game_active_round(p_room_id);

  insert into public.round_players (round_id, user_id)
  values (v_round_id, p_user_id)
  on conflict do nothing;

  insert into public.buildings (round_id, user_id, slot, building_type, status)
  select
    v_round_id,
    p_user_id,
    slot,
    public._game_building_name(slot),
    case when slot <= 2 then 'ready' else 'locked' end
  from generate_series(1, 10) slot
  on conflict do nothing;

  return v_round_id;
end;
$$;

create or replace function public._game_current_room(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room_id uuid;
begin
  select profile.active_room_id into v_room_id
  from public.profiles profile
  where profile.id = p_user_id
    and exists (
      select 1 from public.room_members member
      where member.room_id = profile.active_room_id and member.user_id = p_user_id
    );
  return v_room_id;
end;
$$;

create or replace function public._game_room_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.game_rooms where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public._game_resolve_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_round_id uuid := public._game_active_round(p_room_id);
  v_winner uuid;
  v_winner_name text;
  v_elapsed integer;
  v_new_round uuid;
  v_missile record;
  v_building record;
  v_island_shield timestamptz;
  v_sender_name text;
  v_target_name text;
begin
  for v_building in
    update public.buildings
    set status = 'completed', completed_at = v_now, started_at = null, finishes_at = null
    where round_id = v_round_id and status = 'building' and finishes_at <= v_now
    returning user_id, slot
  loop
    insert into public.game_events (round_id, kind, message, actor_id)
    values (v_round_id, 'build', public._game_building_name(v_building.slot) || ' đã hoàn thành.', v_building.user_id);
  end loop;

  update public.buildings building
  set status = 'ready'
  where building.round_id = v_round_id
    and building.status = 'locked'
    and building.slot > 2
    and not exists (
      select 1 from public.buildings previous
      where previous.round_id = building.round_id
        and previous.user_id = building.user_id
        and previous.slot <= (((building.slot - 1) / 2) * 2)
        and previous.status <> 'completed'
    );

  for v_missile in
    select * from public.missiles
    where round_id = v_round_id and status = 'flying' and arrives_at <= v_now
    order by arrives_at
    for update skip locked
  loop
    select profile.display_name, state.island_shield_until
    into v_target_name, v_island_shield
    from public.profiles profile
    join public.room_player_state state
      on state.room_id = p_room_id and state.user_id = profile.id
    where profile.id = v_missile.to_user;

    select display_name into v_sender_name from public.profiles where id = v_missile.from_user;

    select * into v_building
    from public.buildings
    where round_id = v_round_id and user_id = v_missile.to_user and slot = v_missile.target_slot
    for update;

    if v_building.id is null or v_building.status <> 'completed' then
      update public.missiles set status = 'blocked', resolved_at = v_now where id = v_missile.id;
      insert into public.game_events (round_id, kind, message, actor_id, target_id)
      values (v_round_id, 'blocked', 'Tên lửa của ' || v_sender_name || ' không tìm thấy công trình để phá.', v_missile.from_user, v_missile.to_user);
    elsif coalesce(v_island_shield, '-infinity'::timestamptz) > v_now
      or coalesce(v_building.shield_until, '-infinity'::timestamptz) > v_now then
      update public.missiles set status = 'blocked', resolved_at = v_now where id = v_missile.id;
      insert into public.game_events (round_id, kind, message, actor_id, target_id)
      values (v_round_id, 'blocked', 'Lá chắn của ' || v_target_name || ' đã chặn tên lửa từ ' || v_sender_name || '.', v_missile.from_user, v_missile.to_user);
    else
      update public.buildings
      set status = 'destroyed', started_at = null, finishes_at = null, completed_at = null, shield_until = null
      where id = v_building.id;
      update public.missiles set status = 'hit', resolved_at = v_now where id = v_missile.id;
      update public.room_player_state
      set coin = coin + 10, updated_at = v_now
      where room_id = p_room_id and user_id = v_missile.from_user;
      insert into public.game_events (round_id, kind, message, actor_id, target_id)
      values (
        v_round_id,
        'hit',
        v_sender_name || ' đã phá hủy ' || public._game_building_name(v_missile.target_slot)
          || ' của ' || v_target_name || ' và nhận 10 coin.',
        v_missile.from_user,
        v_missile.to_user
      );
    end if;
  end loop;

  select candidate.user_id into v_winner
  from (
    select player.user_id, max(building.completed_at) finished_at
    from public.round_players player
    join public.buildings building
      on building.round_id = player.round_id and building.user_id = player.user_id
    where player.round_id = v_round_id and building.status = 'completed'
    group by player.user_id
    having count(*) = 10
    order by finished_at, player.user_id
    limit 1
  ) candidate;

  if v_winner is not null then
    select profile.display_name,
      greatest(1, floor(extract(epoch from (v_now - round.started_at)))::integer)
    into v_winner_name, v_elapsed
    from public.profiles profile
    join public.rounds round on round.id = v_round_id
    where profile.id = v_winner;

    update public.rounds
    set status = 'finished', winner_id = v_winner, finished_at = v_now
    where id = v_round_id and status = 'active';

    if found then
      update public.round_players set completed_at = v_now
      where round_id = v_round_id and user_id = v_winner;

      insert into public.room_leaderboard (room_id, user_id, wins, best_time_seconds, updated_at)
      values (p_room_id, v_winner, 1, v_elapsed, v_now)
      on conflict (room_id, user_id) do update
      set
        wins = public.room_leaderboard.wins + 1,
        best_time_seconds = least(
          coalesce(public.room_leaderboard.best_time_seconds, excluded.best_time_seconds),
          excluded.best_time_seconds
        ),
        updated_at = excluded.updated_at;

      update public.missiles set status = 'blocked', resolved_at = v_now
      where round_id = v_round_id and status = 'flying';

      insert into public.game_events (round_id, kind, message, actor_id)
      values (v_round_id, 'win', v_winner_name || ' đã chiến thắng vòng đấu!', v_winner);

      update public.room_player_state
      set coin = 1000, island_shield_until = null, updated_at = v_now
      where room_id = p_room_id;

      insert into public.rounds (room_id, status, started_at)
      values (p_room_id, 'active', v_now)
      returning id into v_new_round;

      insert into public.round_players (round_id, user_id)
      select v_new_round, user_id from public.room_members where room_id = p_room_id;

      insert into public.buildings (round_id, user_id, slot, building_type, status)
      select
        v_new_round,
        member.user_id,
        slot,
        public._game_building_name(slot),
        case when slot <= 2 then 'ready' else 'locked' end
      from public.room_members member
      cross join generate_series(1, 10) slot
      where member.room_id = p_room_id;
    end if;
  end if;
end;
$$;

create or replace function public._game_state_json(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_room_id uuid := public._game_current_room(p_user_id);
  v_round_id uuid;
  v_round_number bigint := 0;
  v_started_at timestamptz := v_now;
  v_profile public.profiles%rowtype;
  v_player_state public.room_player_state%rowtype;
  v_last_reward date;
  v_last_winner jsonb;
begin
  select * into v_profile from public.profiles where id = p_user_id;

  if v_room_id is not null then
    v_round_id := public._game_active_round(v_room_id);
    select
      1 + count(*) filter (where all_rounds.status = 'finished'),
      active.started_at
    into v_round_number, v_started_at
    from public.rounds all_rounds
    cross join public.rounds active
    where all_rounds.room_id = v_room_id
      and active.id = v_round_id
    group by active.started_at;

    select * into v_player_state
    from public.room_player_state
    where room_id = v_room_id and user_id = p_user_id;

    select max(reward_date) into v_last_reward
    from public.room_daily_rewards
    where room_id = v_room_id and user_id = p_user_id;

    select jsonb_build_object('name', profile.display_name, 'round', (
      select count(*) from public.rounds prior
      where prior.room_id = v_room_id and prior.started_at <= round.started_at
    ))
    into v_last_winner
    from public.rounds round
    join public.profiles profile on profile.id = round.winner_id
    where round.room_id = v_room_id
      and round.status = 'finished'
      and round.finished_at > v_now - interval '90 seconds'
    order by round.finished_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'now', floor(extract(epoch from v_now) * 1000),
    'round', v_round_number,
    'roundStartedAt', floor(extract(epoch from v_started_at) * 1000),
    'room', case when v_room_id is null then null else (
      select jsonb_build_object(
        'id', room.id,
        'code', room.code,
        'name', room.name,
        'joinPolicy', room.join_policy,
        'isCreator', room.created_by = p_user_id,
        'memberCount', (select count(*) from public.room_members where room_id = room.id),
        'maxPlayers', 12
      )
      from public.game_rooms room where room.id = v_room_id
    ) end,
    'myRooms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', room.id,
        'code', room.code,
        'name', room.name,
        'joinPolicy', room.join_policy,
        'isCreator', room.created_by = p_user_id,
        'memberCount', (select count(*) from public.room_members count_member where count_member.room_id = room.id),
        'maxPlayers', 12
      ) order by member.joined_at desc)
      from public.room_members member
      join public.game_rooms room on room.id = member.room_id
      where member.user_id = p_user_id
    ), '[]'::jsonb),
    'joinRequests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', request.id,
        'roomId', request.room_id,
        'roomName', room.name,
        'userId', request.user_id,
        'userName', profile.display_name,
        'createdAt', floor(extract(epoch from request.created_at) * 1000)
      ) order by request.created_at)
      from public.room_join_requests request
      join public.game_rooms room on room.id = request.room_id
      join public.profiles profile on profile.id = request.user_id
      where room.created_by = p_user_id and request.status = 'pending'
    ), '[]'::jsonb),
    'me', jsonb_build_object(
      'id', v_profile.id,
      'name', v_profile.display_name,
      'coin', coalesce(v_player_state.coin, 0),
      'islandShieldUntil', case
        when v_player_state.island_shield_until is null then null
        else floor(extract(epoch from v_player_state.island_shield_until) * 1000)
      end,
      'dailyRewardDate', v_last_reward::text
    ),
    'buildings', case when v_room_id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'slot', building.slot,
        'name', public._game_building_name(building.slot),
        'cost', public._game_building_cost(building.slot),
        'duration', public._game_building_duration(building.slot),
        'status', building.status,
        'startedAt', case when building.started_at is null then null else floor(extract(epoch from building.started_at) * 1000) end,
        'finishesAt', case when building.finishes_at is null then null else floor(extract(epoch from building.finishes_at) * 1000) end,
        'shieldUntil', case when building.shield_until is null then null else floor(extract(epoch from building.shield_until) * 1000) end
      ) order by building.slot)
      from public.buildings building
      where building.round_id = v_round_id and building.user_id = p_user_id
    ), '[]'::jsonb) end,
    'missiles', case when v_room_id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', missile.id,
        'fromId', missile.from_user,
        'fromName', sender.display_name,
        'toId', missile.to_user,
        'toName', defender.display_name,
        'launchedAt', floor(extract(epoch from missile.launched_at) * 1000),
        'arrivesAt', floor(extract(epoch from missile.arrives_at) * 1000),
        'status', missile.status
      ) order by missile.launched_at desc)
      from public.missiles missile
      join public.profiles sender on sender.id = missile.from_user
      join public.profiles defender on defender.id = missile.to_user
      where missile.round_id = v_round_id and missile.status = 'flying'
    ), '[]'::jsonb) end,
    'players', case when v_room_id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', profile.id,
        'name', profile.display_name,
        'buildings', (
          select count(*) from public.buildings building
          where building.round_id = v_round_id and building.user_id = profile.id and building.status = 'completed'
        ),
        'wins', coalesce(board.wins, 0),
        'bestTime', board.best_time_seconds
      ) order by coalesce(board.wins, 0) desc, board.best_time_seconds nulls last, profile.display_name)
      from public.room_members member
      join public.profiles profile on profile.id = member.user_id
      left join public.room_leaderboard board on board.room_id = member.room_id and board.user_id = member.user_id
      where member.room_id = v_room_id
    ), '[]'::jsonb) end,
    'events', case when v_room_id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id,
        'kind', event.kind,
        'message', event.message,
        'at', floor(extract(epoch from event.created_at) * 1000)
      ) order by event.created_at desc)
      from (
        select * from public.game_events
        where round_id = v_round_id
        order by created_at desc limit 12
      ) event
    ), '[]'::jsonb) end,
    'winner', v_last_winner ->> 'name',
    'winnerRound', (v_last_winner ->> 'round')::bigint,
    'lastSavedAt', floor(extract(epoch from v_now) * 1000)
  );
end;
$$;

create or replace function public.game_get_state()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public._game_ensure_profile();
  v_room_id uuid;
begin
  v_room_id := public._game_current_room(v_user_id);
  if v_room_id is not null then
    perform public._game_seed_player(v_room_id, v_user_id);
    perform public._game_resolve_room(v_room_id);
  end if;
  return public._game_state_json(v_user_id);
end;
$$;

create or replace function public.game_create_room(p_name text, p_join_policy text default 'open')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public._game_ensure_profile();
  v_room_id uuid;
begin
  p_name := btrim(p_name);
  if char_length(p_name) not between 3 and 40 then
    raise exception using errcode = 'P0001', message = 'Tên phòng phải có từ 3 đến 40 ký tự.';
  end if;
  if p_join_policy not in ('open', 'approval') then
    raise exception using errcode = 'P0001', message = 'Chế độ tham gia không hợp lệ.';
  end if;

  insert into public.game_rooms (code, name, created_by, join_policy)
  values (public._game_room_code(), p_name, v_user_id, p_join_policy)
  returning id into v_room_id;

  insert into public.room_members (room_id, user_id) values (v_room_id, v_user_id);
  update public.profiles set active_room_id = v_room_id where id = v_user_id;
  perform public._game_seed_player(v_room_id, v_user_id);
  return public._game_state_json(v_user_id);
end;
$$;

create or replace function public.game_join_room(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public._game_ensure_profile();
  v_room public.game_rooms%rowtype;
  v_count integer;
begin
  select * into v_room from public.game_rooms where code = upper(btrim(p_code)) for update;
  if v_room.id is null then
    raise exception using errcode = 'P0001', message = 'Không tìm thấy mã trận này.';
  end if;

  if exists (select 1 from public.room_members where room_id = v_room.id and user_id = v_user_id) then
    update public.profiles set active_room_id = v_room.id where id = v_user_id;
    perform public._game_seed_player(v_room.id, v_user_id);
    return jsonb_build_object('status', 'joined', 'state', public._game_state_json(v_user_id));
  end if;

  select count(*) into v_count from public.room_members where room_id = v_room.id;
  if v_count >= 12 then
    raise exception using errcode = 'P0001', message = 'Trận đã đủ 12 người chơi.';
  end if;

  if v_room.join_policy = 'approval' then
    insert into public.room_join_requests (room_id, user_id, status, created_at, reviewed_at)
    values (v_room.id, v_user_id, 'pending', clock_timestamp(), null)
    on conflict (room_id, user_id) do update
    set status = 'pending', created_at = excluded.created_at, reviewed_at = null;
    return jsonb_build_object('status', 'pending', 'state', public._game_state_json(v_user_id));
  end if;

  insert into public.room_members (room_id, user_id) values (v_room.id, v_user_id);
  update public.profiles set active_room_id = v_room.id where id = v_user_id;
  perform public._game_seed_player(v_room.id, v_user_id);
  return jsonb_build_object('status', 'joined', 'state', public._game_state_json(v_user_id));
end;
$$;

create or replace function public.game_select_room(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public._game_ensure_profile();
  v_room_id uuid;
begin
  select room.id into v_room_id
  from public.game_rooms room
  join public.room_members member on member.room_id = room.id
  where room.code = upper(btrim(p_code)) and member.user_id = v_user_id;
  if v_room_id is null then
    raise exception using errcode = 'P0001', message = 'Bạn chưa tham gia trận này.';
  end if;
  update public.profiles set active_room_id = v_room_id where id = v_user_id;
  perform public._game_seed_player(v_room_id, v_user_id);
  perform public._game_resolve_room(v_room_id);
  return public._game_state_json(v_user_id);
end;
$$;

create or replace function public.game_review_join_request(p_request_id uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public._game_ensure_profile();
  v_request public.room_join_requests%rowtype;
  v_count integer;
begin
  select request.* into v_request
  from public.room_join_requests request
  join public.game_rooms room on room.id = request.room_id
  where request.id = p_request_id and room.created_by = v_user_id and request.status = 'pending'
  for update;
  if v_request.id is null then
    raise exception using errcode = 'P0001', message = 'Yêu cầu tham gia không còn hiệu lực.';
  end if;

  if p_approve then
    select count(*) into v_count from public.room_members where room_id = v_request.room_id;
    if v_count >= 12 then
      raise exception using errcode = 'P0001', message = 'Trận đã đủ 12 người chơi.';
    end if;
    insert into public.room_members (room_id, user_id)
    values (v_request.room_id, v_request.user_id)
    on conflict do nothing;
    perform public._game_seed_player(v_request.room_id, v_request.user_id);
  end if;

  update public.room_join_requests
  set status = case when p_approve then 'approved' else 'rejected' end, reviewed_at = clock_timestamp()
  where id = p_request_id;
  return public._game_state_json(v_user_id);
end;
$$;

create or replace function public.game_update_join_policy(p_join_policy text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public._game_ensure_profile();
  v_room_id uuid := public._game_current_room(v_user_id);
begin
  if p_join_policy not in ('open', 'approval') then
    raise exception using errcode = 'P0001', message = 'Chế độ tham gia không hợp lệ.';
  end if;
  update public.game_rooms
  set join_policy = p_join_policy
  where id = v_room_id and created_by = v_user_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'Chỉ người tạo trận mới được đổi chế độ tham gia.';
  end if;
  return public._game_state_json(v_user_id);
end;
$$;

create or replace function public._game_require_context()
returns table(user_id uuid, room_id uuid, round_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  user_id := public._game_ensure_profile();
  room_id := public._game_current_room(user_id);
  if room_id is null then
    raise exception using errcode = 'P0001', message = 'Hãy tạo hoặc tham gia một trận trước.';
  end if;
  round_id := public._game_seed_player(room_id, user_id);
  perform public._game_resolve_room(room_id);
  round_id := public._game_seed_player(room_id, user_id);
  return next;
end;
$$;

create or replace function public.game_start_build(p_slot integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_building public.buildings%rowtype;
  v_cost integer;
  v_duration integer;
  v_active integer;
begin
  if p_slot not between 1 and 10 then
    raise exception using errcode = 'P0001', message = 'Ô công trình không hợp lệ.';
  end if;
  select * into v_context from public._game_require_context();
  perform 1 from public.room_player_state
    where room_id = v_context.room_id and user_id = v_context.user_id for update;

  select * into v_building from public.buildings
  where round_id = v_context.round_id and user_id = v_context.user_id and slot = p_slot
  for update;

  if v_building.status = 'locked' and not exists (
    select 1 from public.buildings previous
    where previous.round_id = v_context.round_id
      and previous.user_id = v_context.user_id
      and previous.slot <= (((p_slot - 1) / 2) * 2)
      and previous.status <> 'completed'
  ) then
    update public.buildings set status = 'ready' where id = v_building.id;
    v_building.status := 'ready';
  end if;

  if v_building.status not in ('ready', 'destroyed') then
    raise exception using errcode = 'P0001', message = 'Công trình này chưa thể xây.';
  end if;
  select count(*) into v_active from public.buildings
  where round_id = v_context.round_id and user_id = v_context.user_id and status = 'building';
  if v_active >= 2 then
    raise exception using errcode = 'P0001', message = 'Bạn chỉ được xây đồng thời 2 công trình.';
  end if;

  v_cost := public._game_building_cost(p_slot);
  v_duration := public._game_building_duration(p_slot);
  update public.room_player_state set coin = coin - v_cost, updated_at = clock_timestamp()
  where room_id = v_context.room_id and user_id = v_context.user_id and coin >= v_cost;
  if not found then
    raise exception using errcode = 'P0001', message = 'Bạn không đủ coin để xây.';
  end if;

  update public.buildings
  set status = 'building', started_at = clock_timestamp(),
    finishes_at = clock_timestamp() + make_interval(secs => v_duration),
    completed_at = null, shield_until = null
  where id = v_building.id;
  insert into public.game_events (round_id, kind, message, actor_id)
  values (v_context.round_id, 'build', 'Bắt đầu xây ' || public._game_building_name(p_slot) || '.', v_context.user_id);
  return public._game_state_json(v_context.user_id);
end;
$$;

create or replace function public.game_shield_building(p_slot integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_building public.buildings%rowtype;
begin
  select * into v_context from public._game_require_context();
  perform 1 from public.room_player_state
    where room_id = v_context.room_id and user_id = v_context.user_id for update;
  select * into v_building from public.buildings
  where round_id = v_context.round_id and user_id = v_context.user_id and slot = p_slot for update;
  if v_building.id is null or v_building.status <> 'completed' then
    raise exception using errcode = 'P0001', message = 'Chỉ công trình đã hoàn thành mới có thể bật khiên.';
  end if;
  if coalesce(v_building.shield_until, '-infinity'::timestamptz) > clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'Công trình này đang được bảo vệ.';
  end if;
  update public.room_player_state set coin = coin - 2, updated_at = clock_timestamp()
  where room_id = v_context.room_id and user_id = v_context.user_id and coin >= 2;
  if not found then raise exception using errcode = 'P0001', message = 'Bạn không đủ coin để bật khiên.'; end if;
  update public.buildings set shield_until = clock_timestamp() + interval '5 minutes' where id = v_building.id;
  insert into public.game_events (round_id, kind, message, actor_id)
  values (v_context.round_id, 'blocked', public._game_building_name(p_slot) || ' được bảo vệ trong 5 phút.', v_context.user_id);
  return public._game_state_json(v_context.user_id);
end;
$$;

create or replace function public.game_shield_island()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_shield timestamptz;
begin
  select * into v_context from public._game_require_context();
  select island_shield_until into v_shield from public.room_player_state
  where room_id = v_context.room_id and user_id = v_context.user_id for update;
  if coalesce(v_shield, '-infinity'::timestamptz) > clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'Đảo đang được bảo vệ.';
  end if;
  update public.room_player_state
  set coin = coin - 15, island_shield_until = clock_timestamp() + interval '5 minutes', updated_at = clock_timestamp()
  where room_id = v_context.room_id and user_id = v_context.user_id and coin >= 15;
  if not found then raise exception using errcode = 'P0001', message = 'Bạn không đủ coin để bảo vệ toàn đảo.'; end if;
  insert into public.game_events (round_id, kind, message, actor_id)
  values (v_context.round_id, 'blocked', 'Lá chắn toàn đảo đã được bật trong 5 phút.', v_context.user_id);
  return public._game_state_json(v_context.user_id);
end;
$$;

create or replace function public.game_launch_missile(p_target_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_active integer;
  v_target_slot integer;
  v_sender_name text;
  v_target_name text;
begin
  select * into v_context from public._game_require_context();
  perform 1 from public.room_player_state
    where room_id = v_context.room_id and user_id = v_context.user_id for update;
  if p_target_user = v_context.user_id then
    raise exception using errcode = 'P0001', message = 'Bạn không thể tự tấn công đảo của mình.';
  end if;
  if not exists (
    select 1 from public.room_members
    where room_id = v_context.room_id and user_id = p_target_user
  ) then
    raise exception using errcode = 'P0001', message = 'Người chơi này không ở trong trận hiện tại.';
  end if;
  select count(*) into v_active from public.missiles
  where round_id = v_context.round_id and from_user = v_context.user_id and status = 'flying';
  if v_active >= 2 then raise exception using errcode = 'P0001', message = 'Bạn đã có 2 tên lửa đang bay.'; end if;
  select slot into v_target_slot from public.buildings
  where round_id = v_context.round_id and user_id = p_target_user and status = 'completed'
  order by random() limit 1;
  if v_target_slot is null then
    raise exception using errcode = 'P0001', message = 'Đảo mục tiêu chưa có công trình hoàn thành.';
  end if;
  update public.room_player_state set coin = coin - 5, updated_at = clock_timestamp()
  where room_id = v_context.room_id and user_id = v_context.user_id and coin >= 5;
  if not found then raise exception using errcode = 'P0001', message = 'Bạn không đủ coin để phóng tên lửa.'; end if;
  select display_name into v_sender_name from public.profiles where id = v_context.user_id;
  select display_name into v_target_name from public.profiles where id = p_target_user;
  insert into public.missiles (round_id, from_user, to_user, target_slot, launched_at, arrives_at)
  values (v_context.round_id, v_context.user_id, p_target_user, v_target_slot, clock_timestamp(), clock_timestamp() + interval '3 minutes');
  insert into public.game_events (round_id, kind, message, actor_id, target_id)
  values (v_context.round_id, 'launch', v_sender_name || ' vừa phóng tên lửa đến đảo của ' || v_target_name || '.', v_context.user_id, p_target_user);
  return public._game_state_json(v_context.user_id);
end;
$$;

create or replace function public.game_claim_daily_reward()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_inserted integer := 0;
begin
  select * into v_context from public._game_require_context();
  perform 1 from public.room_player_state
    where room_id = v_context.room_id and user_id = v_context.user_id for update;
  insert into public.room_daily_rewards (room_id, user_id, reward_date, amount)
  values (v_context.room_id, v_context.user_id, current_date, 20)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    update public.room_player_state set coin = coin + 20, updated_at = clock_timestamp()
    where room_id = v_context.room_id and user_id = v_context.user_id;
    insert into public.game_events (round_id, kind, message, actor_id)
    values (v_context.round_id, 'reward', 'Điểm danh thành công: +20 coin.', v_context.user_id);
  end if;
  return public._game_state_json(v_context.user_id);
end;
$$;

drop policy if exists "game events readable by authenticated players" on public.game_events;
create policy "room members read game events"
  on public.game_events for select to authenticated
  using (exists (
    select 1 from public.rounds round
    join public.room_members member on member.room_id = round.room_id
    where round.id = game_events.round_id and member.user_id = auth.uid()
  ));

drop policy if exists "leaderboard readable by everyone" on public.leaderboard;
revoke select on public.leaderboard from anon, authenticated;

create policy "room members read room leaderboard"
  on public.room_leaderboard for select to authenticated
  using (exists (
    select 1 from public.room_members member
    where member.room_id = room_leaderboard.room_id and member.user_id = auth.uid()
  ));
grant select on public.room_leaderboard to authenticated;

revoke all on function public._game_ensure_profile() from public, anon, authenticated;
revoke all on function public._game_active_round(uuid) from public, anon, authenticated;
revoke all on function public._game_seed_player(uuid, uuid) from public, anon, authenticated;
revoke all on function public._game_current_room(uuid) from public, anon, authenticated;
revoke all on function public._game_room_code() from public, anon, authenticated;
revoke all on function public._game_resolve_room(uuid) from public, anon, authenticated;
revoke all on function public._game_require_context() from public, anon, authenticated;

revoke all on function public.game_create_room(text, text) from public, anon;
revoke all on function public.game_join_room(text) from public, anon;
revoke all on function public.game_select_room(text) from public, anon;
revoke all on function public.game_review_join_request(uuid, boolean) from public, anon;
revoke all on function public.game_update_join_policy(text) from public, anon;

grant execute on function public.game_create_room(text, text) to authenticated;
grant execute on function public.game_join_room(text) to authenticated;
grant execute on function public.game_select_room(text) to authenticated;
grant execute on function public.game_review_join_request(uuid, boolean) to authenticated;
grant execute on function public.game_update_join_policy(text) to authenticated;

alter table public.room_join_requests replica identity full;
alter table public.room_leaderboard replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_join_requests'
    ) then
      alter publication supabase_realtime add table public.room_join_requests;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_leaderboard'
    ) then
      alter publication supabase_realtime add table public.room_leaderboard;
    end if;
  end if;
end;
$$;

commit;
