-- GoldFinger Island authoritative multiplayer migration.
-- Run this after 20260717000000_schema.sql in the Supabase SQL Editor.

begin;

alter table public.profiles
  add column if not exists island_shield_until timestamptz;

alter table public.buildings
  add column if not exists completed_at timestamptz;

create table if not exists public.round_players (
  round_id uuid not null references public.rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (round_id, user_id)
);

create table if not exists public.game_events (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  kind text not null check (kind in ('build', 'launch', 'hit', 'blocked', 'reward', 'win')),
  message text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  target_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists game_events_round_created_idx
  on public.game_events (round_id, created_at desc);

create index if not exists missiles_flying_arrival_idx
  on public.missiles (arrives_at)
  where status = 'flying';

alter table public.round_players enable row level security;
alter table public.game_events enable row level security;

drop policy if exists "game events readable by authenticated players" on public.game_events;
create policy "game events readable by authenticated players"
  on public.game_events for select to authenticated using (true);

-- Direct writes would let a browser mint coins or finish buildings instantly.
drop policy if exists "profiles readable by authenticated players" on public.profiles;
drop policy if exists "players update own profile" on public.profiles;
drop policy if exists "rounds readable by authenticated players" on public.rounds;
drop policy if exists "buildings readable by authenticated players" on public.buildings;
drop policy if exists "players manage own buildings" on public.buildings;
drop policy if exists "players launch own missiles" on public.missiles;

revoke select on public.profiles from anon, authenticated;
revoke select on public.rounds from anon, authenticated;
revoke select on public.round_players from anon, authenticated;
revoke select on public.buildings from anon, authenticated;
revoke select on public.daily_rewards from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.rounds from anon, authenticated;
revoke insert, update, delete on public.round_players from anon, authenticated;
revoke insert, update, delete on public.buildings from anon, authenticated;
revoke insert, update, delete on public.missiles from anon, authenticated;
revoke insert, update, delete on public.leaderboard from anon, authenticated;
revoke insert, update, delete on public.daily_rewards from anon, authenticated;
revoke insert, update, delete on public.game_events from anon, authenticated;

grant select on public.leaderboard to anon, authenticated;
grant select on public.game_events to authenticated;

create or replace function public._game_building_name(p_slot integer)
returns text
language sql
immutable
as $$
  select case
    when p_slot between 1 and 2 then 'Lều thám hiểm'
    when p_slot between 3 and 4 then 'Nhà gỗ'
    when p_slot between 5 and 6 then 'Biệt thự'
    when p_slot between 7 and 8 then 'Khu nghỉ dưỡng'
    when p_slot between 9 and 10 then 'Lâu đài'
  end;
$$;

create or replace function public._game_building_cost(p_slot integer)
returns integer
language sql
immutable
as $$
  select case
    when p_slot between 1 and 2 then 30
    when p_slot between 3 and 4 then 55
    when p_slot between 5 and 6 then 85
    when p_slot between 7 and 8 then 125
    when p_slot between 9 and 10 then 155
  end;
$$;

create or replace function public._game_building_duration(p_slot integer)
returns integer
language sql
immutable
as $$
  select case
    when p_slot between 1 and 2 then 60
    when p_slot between 3 and 4 then 90
    when p_slot between 5 and 6 then 120
    when p_slot between 7 and 8 then 180
    when p_slot between 9 and 10 then 240
  end;
$$;

create or replace function public._game_active_round()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_round_id uuid;
begin
  select id
    into v_round_id
  from public.rounds
  where status = 'active'
  order by started_at
  limit 1;

  if v_round_id is null then
    begin
      insert into public.rounds (status)
      values ('active')
      returning id into v_round_id;
    exception
      when unique_violation then
        select id
          into v_round_id
        from public.rounds
        where status = 'active'
        order by started_at
        limit 1;
    end;
  end if;

  return v_round_id;
end;
$$;

create or replace function public._game_ensure_player()
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_round_id uuid;
  v_email text;
  v_name text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'Bạn cần đăng nhập để chơi online.';
  end if;

  select
    email,
    coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1), 'Island Player')
  into v_email, v_name
  from auth.users
  where id = v_user_id;

  insert into public.profiles (id, display_name)
  values (v_user_id, coalesce(v_name, v_email, 'Island Player'))
  on conflict (id) do nothing;

  insert into public.leaderboard (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  v_round_id := public._game_active_round();

  insert into public.round_players (round_id, user_id)
  values (v_round_id, v_user_id)
  on conflict (round_id, user_id) do nothing;

  insert into public.buildings (
    round_id,
    user_id,
    slot,
    building_type,
    status
  )
  select
    v_round_id,
    v_user_id,
    slot,
    public._game_building_name(slot),
    case when slot <= 2 then 'ready' else 'locked' end
  from generate_series(1, 10) as slot
  on conflict (round_id, user_id, slot) do nothing;

  return v_round_id;
end;
$$;

create or replace function public._game_resolve()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_active_round uuid;
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
  v_active_round := public._game_active_round();

  for v_building in
    update public.buildings
    set
      status = 'completed',
      completed_at = v_now,
      started_at = null,
      finishes_at = null
    where round_id = v_active_round
      and status = 'building'
      and finishes_at <= v_now
    returning user_id, slot
  loop
    insert into public.game_events (round_id, kind, message, actor_id)
    values (
      v_active_round,
      'build',
      public._game_building_name(v_building.slot) || ' đã hoàn thành.',
      v_building.user_id
    );
  end loop;

  update public.buildings as building
  set status = 'ready'
  where building.round_id = v_active_round
    and building.status = 'locked'
    and building.slot > 2
    and not exists (
      select 1
      from public.buildings as previous
      where previous.round_id = building.round_id
        and previous.user_id = building.user_id
        and previous.slot <= (((building.slot - 1) / 2) * 2)
        and previous.status <> 'completed'
    );

  for v_missile in
    select *
    from public.missiles
    where round_id = v_active_round
      and status = 'flying'
      and arrives_at <= v_now
    order by arrives_at
    for update skip locked
  loop
    select display_name, island_shield_until
      into v_target_name, v_island_shield
    from public.profiles
    where id = v_missile.to_user;

    select display_name
      into v_sender_name
    from public.profiles
    where id = v_missile.from_user;

    select *
      into v_building
    from public.buildings
    where round_id = v_missile.round_id
      and user_id = v_missile.to_user
      and slot = v_missile.target_slot
    for update;

    if v_building.id is null or v_building.status <> 'completed' then
      update public.missiles
      set status = 'blocked', resolved_at = v_now
      where id = v_missile.id;

      insert into public.game_events (round_id, kind, message, actor_id, target_id)
      values (
        v_active_round,
        'blocked',
        'Tên lửa của ' || v_sender_name || ' không tìm thấy công trình để phá.',
        v_missile.from_user,
        v_missile.to_user
      );
    elsif coalesce(v_island_shield, '-infinity'::timestamptz) > v_now
      or coalesce(v_building.shield_until, '-infinity'::timestamptz) > v_now then
      update public.missiles
      set status = 'blocked', resolved_at = v_now
      where id = v_missile.id;

      insert into public.game_events (round_id, kind, message, actor_id, target_id)
      values (
        v_active_round,
        'blocked',
        'Lá chắn của ' || v_target_name || ' đã chặn tên lửa từ ' || v_sender_name || '.',
        v_missile.from_user,
        v_missile.to_user
      );
    else
      update public.buildings
      set
        status = 'destroyed',
        started_at = null,
        finishes_at = null,
        completed_at = null,
        shield_until = null
      where id = v_building.id;

      update public.missiles
      set status = 'hit', resolved_at = v_now
      where id = v_missile.id;

      update public.profiles
      set coin = coin + 10, updated_at = v_now
      where id = v_missile.from_user;

      insert into public.game_events (round_id, kind, message, actor_id, target_id)
      values (
        v_active_round,
        'hit',
        v_sender_name || ' đã phá hủy ' || public._game_building_name(v_missile.target_slot)
          || ' của ' || v_target_name || ' và nhận 10 coin.',
        v_missile.from_user,
        v_missile.to_user
      );
    end if;
  end loop;

  select candidate.user_id
    into v_winner
  from (
    select
      player.user_id,
      max(building.completed_at) as finished_at
    from public.round_players as player
    join public.buildings as building
      on building.round_id = player.round_id
      and building.user_id = player.user_id
    where player.round_id = v_active_round
      and building.status = 'completed'
    group by player.user_id
    having count(*) = 10
    order by finished_at, player.user_id
    limit 1
  ) as candidate;

  if v_winner is not null then
    select profile.display_name,
      greatest(1, floor(extract(epoch from (v_now - round.started_at)))::integer)
    into v_winner_name, v_elapsed
    from public.profiles as profile
    join public.rounds as round on round.id = v_active_round
    where profile.id = v_winner;

    update public.rounds
    set status = 'finished', winner_id = v_winner, finished_at = v_now
    where id = v_active_round
      and status = 'active';

    if found then
      update public.round_players
      set completed_at = v_now
      where round_id = v_active_round
        and user_id = v_winner;

      insert into public.leaderboard (user_id, wins, best_time_seconds, updated_at)
      values (v_winner, 1, v_elapsed, v_now)
      on conflict (user_id) do update
      set
        wins = public.leaderboard.wins + 1,
        best_time_seconds = least(
          coalesce(public.leaderboard.best_time_seconds, excluded.best_time_seconds),
          excluded.best_time_seconds
        ),
        updated_at = excluded.updated_at;

      update public.missiles
      set status = 'blocked', resolved_at = v_now
      where round_id = v_active_round
        and status = 'flying';

      insert into public.game_events (round_id, kind, message, actor_id)
      values (
        v_active_round,
        'win',
        v_winner_name || ' đã chiến thắng vòng đấu!',
        v_winner
      );

      update public.profiles as profile
      set
        coin = 1000,
        island_shield_until = null,
        updated_at = v_now
      where exists (
        select 1
        from public.round_players as player
        where player.round_id = v_active_round
          and player.user_id = profile.id
      );

      insert into public.rounds (status, started_at)
      values ('active', v_now)
      returning id into v_new_round;
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
  v_round_id uuid;
  v_round_number bigint;
  v_started_at timestamptz;
  v_profile public.profiles%rowtype;
  v_last_reward date;
  v_last_winner jsonb;
begin
  select round.id, round.round_number, round.started_at
    into v_round_id, v_round_number, v_started_at
  from public.rounds as round
  where round.status = 'active'
  order by round.started_at
  limit 1;

  select *
    into v_profile
  from public.profiles
  where id = p_user_id;

  select max(reward_date)
    into v_last_reward
  from public.daily_rewards
  where user_id = p_user_id;

  select jsonb_build_object(
    'name', profile.display_name,
    'round', round.round_number
  )
    into v_last_winner
  from public.rounds as round
  join public.profiles as profile on profile.id = round.winner_id
  where round.status = 'finished'
    and round.finished_at > v_now - interval '90 seconds'
  order by round.finished_at desc
  limit 1;

  return jsonb_build_object(
    'now', floor(extract(epoch from v_now) * 1000),
    'round', v_round_number,
    'roundStartedAt', floor(extract(epoch from v_started_at) * 1000),
    'me', jsonb_build_object(
      'id', v_profile.id,
      'name', v_profile.display_name,
      'coin', v_profile.coin,
      'islandShieldUntil', case
        when v_profile.island_shield_until is null then null
        else floor(extract(epoch from v_profile.island_shield_until) * 1000)
      end,
      'dailyRewardDate', v_last_reward::text
    ),
    'buildings', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'slot', building.slot,
          'name', public._game_building_name(building.slot),
          'cost', public._game_building_cost(building.slot),
          'duration', public._game_building_duration(building.slot),
          'status', building.status,
          'startedAt', case
            when building.started_at is null then null
            else floor(extract(epoch from building.started_at) * 1000)
          end,
          'finishesAt', case
            when building.finishes_at is null then null
            else floor(extract(epoch from building.finishes_at) * 1000)
          end,
          'shieldUntil', case
            when building.shield_until is null then null
            else floor(extract(epoch from building.shield_until) * 1000)
          end
        )
        order by building.slot
      )
      from public.buildings as building
      where building.round_id = v_round_id
        and building.user_id = p_user_id
    ), '[]'::jsonb),
    'missiles', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', missile.id,
          'fromId', missile.from_user,
          'fromName', sender.display_name,
          'toId', missile.to_user,
          'toName', defender.display_name,
          'launchedAt', floor(extract(epoch from missile.launched_at) * 1000),
          'arrivesAt', floor(extract(epoch from missile.arrives_at) * 1000),
          'status', missile.status
        )
        order by missile.launched_at desc
      )
      from public.missiles as missile
      join public.profiles as sender on sender.id = missile.from_user
      join public.profiles as defender on defender.id = missile.to_user
      where missile.round_id = v_round_id
        and missile.status = 'flying'
    ), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', profile.id,
          'name', profile.display_name,
          'buildings', (
            select count(*)
            from public.buildings as building
            where building.round_id = v_round_id
              and building.user_id = profile.id
              and building.status = 'completed'
          ),
          'wins', coalesce(board.wins, 0),
          'bestTime', board.best_time_seconds
        )
        order by coalesce(board.wins, 0) desc, board.best_time_seconds nulls last, profile.display_name
      )
      from public.round_players as player
      join public.profiles as profile on profile.id = player.user_id
      left join public.leaderboard as board on board.user_id = profile.id
      where player.round_id = v_round_id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', event.id,
          'kind', event.kind,
          'message', event.message,
          'at', floor(extract(epoch from event.created_at) * 1000)
        )
        order by event.created_at desc
      )
      from (
        select *
        from public.game_events
        where round_id = v_round_id
        order by created_at desc
        limit 12
      ) as event
    ), '[]'::jsonb),
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
begin
  perform public._game_ensure_player();
  perform public._game_resolve();
  perform public._game_ensure_player();
  return public._game_state_json(auth.uid());
end;
$$;

create or replace function public.game_start_build(p_slot integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_round_id uuid;
  v_building public.buildings%rowtype;
  v_cost integer;
  v_duration integer;
  v_active integer;
begin
  if p_slot not between 1 and 10 then
    raise exception using errcode = 'P0001', message = 'Ô công trình không hợp lệ.';
  end if;

  v_round_id := public._game_ensure_player();
  perform public._game_resolve();
  v_round_id := public._game_ensure_player();
  perform 1 from public.profiles where id = v_user_id for update;

  select *
    into v_building
  from public.buildings
  where round_id = v_round_id
    and user_id = v_user_id
    and slot = p_slot
  for update;

  if v_building.status = 'locked' and not exists (
    select 1
    from public.buildings as previous
    where previous.round_id = v_round_id
      and previous.user_id = v_user_id
      and previous.slot <= (((p_slot - 1) / 2) * 2)
      and previous.status <> 'completed'
  ) then
    update public.buildings
    set status = 'ready'
    where id = v_building.id;
    v_building.status := 'ready';
  end if;

  if v_building.status not in ('ready', 'destroyed') then
    raise exception using errcode = 'P0001', message = 'Công trình này chưa thể xây.';
  end if;

  select count(*)
    into v_active
  from public.buildings
  where round_id = v_round_id
    and user_id = v_user_id
    and status = 'building';

  if v_active >= 2 then
    raise exception using errcode = 'P0001', message = 'Bạn chỉ được xây đồng thời 2 công trình.';
  end if;

  v_cost := public._game_building_cost(p_slot);
  v_duration := public._game_building_duration(p_slot);

  update public.profiles
  set coin = coin - v_cost, updated_at = clock_timestamp()
  where id = v_user_id
    and coin >= v_cost;

  if not found then
    raise exception using errcode = 'P0001', message = 'Bạn không đủ coin để xây.';
  end if;

  update public.buildings
  set
    status = 'building',
    started_at = clock_timestamp(),
    finishes_at = clock_timestamp() + make_interval(secs => v_duration),
    completed_at = null,
    shield_until = null
  where id = v_building.id;

  insert into public.game_events (round_id, kind, message, actor_id)
  values (
    v_round_id,
    'build',
    'Bắt đầu xây ' || public._game_building_name(p_slot) || '.',
    v_user_id
  );

  return public._game_state_json(v_user_id);
end;
$$;

create or replace function public.game_shield_building(p_slot integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_round_id uuid;
  v_building public.buildings%rowtype;
begin
  v_round_id := public._game_ensure_player();
  perform public._game_resolve();
  v_round_id := public._game_ensure_player();
  perform 1 from public.profiles where id = v_user_id for update;

  select *
    into v_building
  from public.buildings
  where round_id = v_round_id
    and user_id = v_user_id
    and slot = p_slot
  for update;

  if v_building.id is null or v_building.status <> 'completed' then
    raise exception using errcode = 'P0001', message = 'Chỉ công trình đã hoàn thành mới có thể bật khiên.';
  end if;

  if coalesce(v_building.shield_until, '-infinity'::timestamptz) > clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'Công trình này đang được bảo vệ.';
  end if;

  update public.profiles
  set coin = coin - 2, updated_at = clock_timestamp()
  where id = v_user_id
    and coin >= 2;

  if not found then
    raise exception using errcode = 'P0001', message = 'Bạn không đủ coin để bật khiên.';
  end if;

  update public.buildings
  set shield_until = clock_timestamp() + interval '5 minutes'
  where id = v_building.id;

  insert into public.game_events (round_id, kind, message, actor_id)
  values (
    v_round_id,
    'blocked',
    public._game_building_name(p_slot) || ' được bảo vệ trong 5 phút.',
    v_user_id
  );

  return public._game_state_json(v_user_id);
end;
$$;

create or replace function public.game_shield_island()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_round_id uuid;
  v_current_shield timestamptz;
begin
  v_round_id := public._game_ensure_player();
  perform public._game_resolve();
  v_round_id := public._game_ensure_player();
  perform 1 from public.profiles where id = v_user_id for update;

  select island_shield_until
    into v_current_shield
  from public.profiles
  where id = v_user_id
  for update;

  if coalesce(v_current_shield, '-infinity'::timestamptz) > clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'Đảo đang được bảo vệ.';
  end if;

  update public.profiles
  set
    coin = coin - 15,
    island_shield_until = clock_timestamp() + interval '5 minutes',
    updated_at = clock_timestamp()
  where id = v_user_id
    and coin >= 15;

  if not found then
    raise exception using errcode = 'P0001', message = 'Bạn không đủ coin để bảo vệ toàn đảo.';
  end if;

  insert into public.game_events (round_id, kind, message, actor_id)
  values (
    v_round_id,
    'blocked',
    'Lá chắn toàn đảo đã được bật trong 5 phút.',
    v_user_id
  );

  return public._game_state_json(v_user_id);
end;
$$;

create or replace function public.game_launch_missile(p_target_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_round_id uuid;
  v_active integer;
  v_target_slot integer;
  v_sender_name text;
  v_target_name text;
begin
  v_round_id := public._game_ensure_player();
  perform public._game_resolve();
  v_round_id := public._game_ensure_player();
  perform 1 from public.profiles where id = v_user_id for update;

  if p_target_user = v_user_id then
    raise exception using errcode = 'P0001', message = 'Bạn không thể tự tấn công đảo của mình.';
  end if;

  if not exists (
    select 1
    from public.round_players
    where round_id = v_round_id
      and user_id = p_target_user
  ) then
    raise exception using errcode = 'P0001', message = 'Người chơi này không ở trong vòng hiện tại.';
  end if;

  select count(*)
    into v_active
  from public.missiles
  where round_id = v_round_id
    and from_user = v_user_id
    and status = 'flying';

  if v_active >= 2 then
    raise exception using errcode = 'P0001', message = 'Bạn đã có 2 tên lửa đang bay.';
  end if;

  select slot
    into v_target_slot
  from public.buildings
  where round_id = v_round_id
    and user_id = p_target_user
    and status = 'completed'
  order by random()
  limit 1;

  if v_target_slot is null then
    raise exception using errcode = 'P0001', message = 'Đảo mục tiêu chưa có công trình hoàn thành.';
  end if;

  update public.profiles
  set coin = coin - 5, updated_at = clock_timestamp()
  where id = v_user_id
    and coin >= 5;

  if not found then
    raise exception using errcode = 'P0001', message = 'Bạn không đủ coin để phóng tên lửa.';
  end if;

  select display_name into v_sender_name
  from public.profiles where id = v_user_id;

  select display_name into v_target_name
  from public.profiles where id = p_target_user;

  insert into public.missiles (
    round_id,
    from_user,
    to_user,
    target_slot,
    launched_at,
    arrives_at
  )
  values (
    v_round_id,
    v_user_id,
    p_target_user,
    v_target_slot,
    clock_timestamp(),
    clock_timestamp() + interval '3 minutes'
  );

  insert into public.game_events (round_id, kind, message, actor_id, target_id)
  values (
    v_round_id,
    'launch',
    v_sender_name || ' vừa phóng tên lửa đến đảo của ' || v_target_name || '.',
    v_user_id,
    p_target_user
  );

  return public._game_state_json(v_user_id);
end;
$$;

create or replace function public.game_claim_daily_reward()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_round_id uuid;
  v_inserted integer := 0;
begin
  v_round_id := public._game_ensure_player();
  perform public._game_resolve();
  v_round_id := public._game_ensure_player();
  perform 1 from public.profiles where id = v_user_id for update;

  insert into public.daily_rewards (user_id, reward_date, amount)
  values (v_user_id, current_date, 20)
  on conflict (user_id, reward_date) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    update public.profiles
    set coin = coin + 20, updated_at = clock_timestamp()
    where id = v_user_id;

    insert into public.game_events (round_id, kind, message, actor_id)
    values (
      v_round_id,
      'reward',
      'Điểm danh thành công: +20 coin.',
      v_user_id
    );
  end if;

  return public._game_state_json(v_user_id);
end;
$$;

revoke all on function public._game_building_name(integer) from public, anon, authenticated;
revoke all on function public._game_building_cost(integer) from public, anon, authenticated;
revoke all on function public._game_building_duration(integer) from public, anon, authenticated;
revoke all on function public._game_active_round() from public, anon, authenticated;
revoke all on function public._game_ensure_player() from public, anon, authenticated;
revoke all on function public._game_resolve() from public, anon, authenticated;
revoke all on function public._game_state_json(uuid) from public, anon, authenticated;

revoke all on function public.game_get_state() from public, anon;
revoke all on function public.game_start_build(integer) from public, anon;
revoke all on function public.game_shield_building(integer) from public, anon;
revoke all on function public.game_shield_island() from public, anon;
revoke all on function public.game_launch_missile(uuid) from public, anon;
revoke all on function public.game_claim_daily_reward() from public, anon;

grant execute on function public.game_get_state() to authenticated;
grant execute on function public.game_start_build(integer) to authenticated;
grant execute on function public.game_shield_building(integer) to authenticated;
grant execute on function public.game_shield_island() to authenticated;
grant execute on function public.game_launch_missile(uuid) to authenticated;
grant execute on function public.game_claim_daily_reward() to authenticated;

alter table public.game_events replica identity full;
alter table public.leaderboard replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'game_events'
    ) then
      alter publication supabase_realtime add table public.game_events;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'leaderboard'
    ) then
      alter publication supabase_realtime add table public.leaderboard;
    end if;
  end if;
end;
$$;

commit;
