import {
  BUILDING_SHIELD_COST,
  BUILD_LIMIT,
  DAILY_REWARD,
  ISLAND_SHIELD_COST,
  MISSILE_COST,
  MISSILE_FLIGHT_SECONDS,
  MISSILE_LIMIT,
  MISSILE_REWARD,
  SHIELD_SECONDS,
  STARTING_COIN,
  createBuildings,
} from "@/lib/game-rules";
import type { GameEvent, GameState, Missile, Player } from "@/types/game";

const BOT_PLAYERS: Player[] = [
  { id: "minh", name: "Minh", avatar: "M", color: "#ef5b5b", buildings: 6, wins: 4, bestTime: 812 },
  { id: "lan", name: "Lan", avatar: "L", color: "#9b6bdc", buildings: 8, wins: 3, bestTime: 865 },
  { id: "bao", name: "Bảo", avatar: "B", color: "#ff943d", buildings: 5, wins: 2, bestTime: 932 },
];

function event(kind: GameEvent["kind"], message: string, at: number): GameEvent {
  return { id: `${at}-${Math.random().toString(36).slice(2)}`, at, kind, message };
}

export function createInitialState(now = Date.now()): GameState {
  const seededMissile: Missile = {
    id: `seed-${now}`,
    from: "Minh",
    to: "Bạn",
    launchedAt: now - 30_000,
    arrivesAt: now + 150_000,
    targetBuildingId: 1,
    status: "flying",
  };

  return {
    now,
    roundStartedAt: now,
    coin: STARTING_COIN,
    buildings: createBuildings(),
    missiles: [seededMissile],
    players: [
      { id: "you", name: "Bạn", avatar: "B", color: "#1aa9e8", buildings: 0, wins: 0, bestTime: null },
      ...BOT_PLAYERS,
    ],
    islandShieldUntil: null,
    dailyRewardDate: null,
    events: [event("launch", "Cảnh báo: Minh vừa phóng tên lửa đến đảo của bạn!", now - 30_000)],
    round: 1,
    winner: null,
    winnerRound: null,
    lastSavedAt: now,
  };
}

function unlockBuildings(state: GameState) {
  const buildings = state.buildings.map((building) => ({ ...building }));
  for (let tier = 1; tier < 5; tier += 1) {
    const priorComplete = buildings.slice(0, tier * 2).every((building) => building.status === "completed");
    if (priorComplete) {
      for (let index = tier * 2; index < tier * 2 + 2; index += 1) {
        if (buildings[index].status === "locked") buildings[index].status = "ready";
      }
    }
  }
  return buildings;
}

export function tickGame(input: GameState, now: number): GameState {
  let state: GameState = {
    ...input,
    now,
    buildings: input.buildings.map((building) => ({ ...building })),
    missiles: input.missiles.map((missile) => ({ ...missile })),
    players: input.players.map((player) => ({ ...player })),
    events: [...input.events],
  };

  let changed = false;
  state.buildings.forEach((building) => {
    if (building.status === "building" && building.finishesAt && building.finishesAt <= now) {
      building.status = "completed";
      building.startedAt = null;
      building.finishesAt = null;
      changed = true;
      state.events.unshift(event("build", `${building.name} đã hoàn thành.`, now));
    }
  });

  state.missiles.forEach((missile) => {
    if (missile.status !== "flying" || missile.arrivesAt > now) return;
    changed = true;

    if (missile.to === "Bạn") {
      const target = state.buildings.find((building) => building.id === missile.targetBuildingId);
      const protectedIsland = Boolean(state.islandShieldUntil && state.islandShieldUntil > now);
      const protectedBuilding = Boolean(target?.shieldUntil && target.shieldUntil > now);
      if (!target || target.status !== "completed") {
        missile.status = "blocked";
        state.events.unshift(event("blocked", `Tên lửa của ${missile.from} không tìm thấy công trình để phá.`, now));
      } else if (protectedIsland || protectedBuilding) {
        missile.status = "blocked";
        state.events.unshift(event("blocked", `Lá chắn đã chặn tên lửa của ${missile.from}.`, now));
      } else {
        missile.status = "hit";
        target.status = "destroyed";
        state.events.unshift(event("hit", `${missile.from} đã phá hủy ${target.name} của bạn.`, now));
      }
    } else if (missile.from === "Bạn") {
      missile.status = "hit";
      state.coin += MISSILE_REWARD;
      const opponent = state.players.find((player) => player.name === missile.to);
      if (opponent) opponent.buildings = Math.max(0, opponent.buildings - 1);
      state.events.unshift(event("hit", `Tên lửa trúng đảo ${missile.to}. Bạn nhận ${MISSILE_REWARD} coin!`, now));
    } else {
      missile.status = "hit";
      state.events.unshift(event("hit", `${missile.from} đã tấn công thành công đảo ${missile.to}.`, now));
    }
  });

  if (changed) {
    state.buildings = unlockBuildings(state);
    const completed = state.buildings.filter((building) => building.status === "completed").length;
    const you = state.players.find((player) => player.id === "you");
    if (you) you.buildings = completed;

    if (completed === 10 && !state.winner) {
      const elapsed = Math.floor((now - state.roundStartedAt) / 1000);
      state.winner = "Bạn";
      state.winnerRound = state.round;
      if (you) {
        you.wins += 1;
        you.bestTime = you.bestTime === null ? elapsed : Math.min(you.bestTime, elapsed);
      }
      state.events.unshift(event("win", `Bạn thắng vòng ${state.round}!`, now));
    }
  }

  return { ...state, events: state.events.slice(0, 12), lastSavedAt: now };
}

export function buildBuilding(state: GameState, buildingId: number): GameState {
  const next = tickGame(state, state.now);
  const target = next.buildings.find((building) => building.id === buildingId);
  const active = next.buildings.filter((building) => building.status === "building").length;
  if (!target || !["ready", "destroyed"].includes(target.status) || active >= BUILD_LIMIT || next.coin < target.cost) return next;

  target.status = "building";
  target.startedAt = next.now;
  target.finishesAt = next.now + target.duration * 1000;
  next.coin -= target.cost;
  next.events.unshift(event("build", `Bắt đầu xây ${target.name}.`, next.now));
  return { ...next };
}

export function shieldBuilding(state: GameState, buildingId: number): GameState {
  const next = tickGame(state, state.now);
  const target = next.buildings.find((building) => building.id === buildingId);
  if (!target || target.status !== "completed" || next.coin < BUILDING_SHIELD_COST) return next;
  target.shieldUntil = next.now + SHIELD_SECONDS * 1000;
  next.coin -= BUILDING_SHIELD_COST;
  next.events.unshift(event("blocked", `${target.name} được bảo vệ trong 5 phút.`, next.now));
  return { ...next };
}

export function shieldIsland(state: GameState): GameState {
  const next = tickGame(state, state.now);
  if (next.coin < ISLAND_SHIELD_COST) return next;
  next.coin -= ISLAND_SHIELD_COST;
  next.islandShieldUntil = next.now + SHIELD_SECONDS * 1000;
  next.events.unshift(event("blocked", "Lá chắn toàn đảo đã được bật trong 5 phút.", next.now));
  return next;
}

export function launchMissile(state: GameState, targetPlayerId: string): GameState {
  const next = tickGame(state, state.now);
  const active = next.missiles.filter((missile) => missile.from === "Bạn" && missile.status === "flying").length;
  const target = next.players.find((player) => player.id === targetPlayerId && player.id !== "you");
  if (!target || active >= MISSILE_LIMIT || next.coin < MISSILE_COST) return next;

  next.coin -= MISSILE_COST;
  next.missiles.push({
    id: `missile-${next.now}-${target.id}`,
    from: "Bạn",
    to: target.name,
    launchedAt: next.now,
    arrivesAt: next.now + MISSILE_FLIGHT_SECONDS * 1000,
    targetBuildingId: Math.max(1, Math.min(10, target.buildings)),
    status: "flying",
  });
  next.events.unshift(event("launch", `Bạn vừa phóng tên lửa đến đảo ${target.name}.`, next.now));
  return next;
}

export function claimDailyReward(state: GameState): GameState {
  const today = new Date(state.now).toISOString().slice(0, 10);
  if (state.dailyRewardDate === today) return state;
  return {
    ...state,
    coin: state.coin + DAILY_REWARD,
    dailyRewardDate: today,
    events: [event("reward", `Điểm danh thành công: +${DAILY_REWARD} coin.`, state.now), ...state.events],
  };
}

export function resetRound(state: GameState): GameState {
  const next = createInitialState(state.now);
  next.players = state.players.map((player) => ({ ...player, buildings: 0 }));
  next.round = state.round + 1;
  next.dailyRewardDate = state.dailyRewardDate;
  return next;
}
