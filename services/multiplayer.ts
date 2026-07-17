import { createBuildings } from "@/lib/game-rules";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  BuildingStatus,
  GameEvent,
  GameRoom,
  GameState,
  JoinPolicy,
  MissileStatus,
  Player,
  RoomJoinRequest,
} from "@/types/game";
import type { RealtimeChannel } from "@supabase/supabase-js";

type CloudBuilding = {
  slot: number;
  name: string;
  cost: number;
  duration: number;
  status: BuildingStatus;
  startedAt: number | null;
  finishesAt: number | null;
  shieldUntil: number | null;
};

type CloudMissile = {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  launchedAt: number;
  arrivesAt: number;
  status: MissileStatus;
};

type CloudPlayer = {
  id: string;
  name: string;
  buildings: number;
  wins: number;
  bestTime: number | null;
};

type CloudState = {
  now: number;
  round: number;
  roundStartedAt: number;
  me: {
    id: string;
    name: string;
    coin: number;
    islandShieldUntil: number | null;
    dailyRewardDate: string | null;
  };
  buildings: CloudBuilding[];
  missiles: CloudMissile[];
  players: CloudPlayer[];
  events: GameEvent[];
  winner: string | null;
  winnerRound: number | null;
  lastSavedAt: number;
  room: GameRoom | null;
  myRooms: GameRoom[];
  joinRequests: RoomJoinRequest[];
};

type MultiplayerAction =
  | { name: "game_get_state"; args?: never }
  | { name: "game_start_build"; args: { p_slot: number } }
  | { name: "game_shield_building"; args: { p_slot: number } }
  | { name: "game_shield_island"; args?: never }
  | { name: "game_launch_missile"; args: { p_target_user: string } }
  | { name: "game_claim_daily_reward"; args?: never }
  | { name: "game_create_room"; args: { p_name: string; p_join_policy: JoinPolicy } }
  | { name: "game_select_room"; args: { p_code: string } }
  | { name: "game_review_join_request"; args: { p_request_id: string; p_approve: boolean } }
  | { name: "game_update_join_policy"; args: { p_join_policy: JoinPolicy } };

type JoinRoomResult = {
  status: "joined" | "pending";
  state: CloudState;
};

const PLAYER_COLORS = ["#1aa9e8", "#ef5b5b", "#9b6bdc", "#ff943d", "#22a96b", "#e0a415"];

function colorForPlayer(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return PLAYER_COLORS[hash % PLAYER_COLORS.length];
}

function asNumber(value: number | string | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapPlayer(player: CloudPlayer, currentUserId: string): Player {
  return {
    id: player.id === currentUserId ? "you" : player.id,
    name: player.name,
    avatar: player.name.trim().slice(0, 1).toUpperCase() || "?",
    color: colorForPlayer(player.id),
    buildings: asNumber(player.buildings),
    wins: asNumber(player.wins),
    bestTime: player.bestTime === null ? null : asNumber(player.bestTime),
  };
}

export function mapCloudState(payload: CloudState): GameState {
  const templates = createBuildings();
  const currentUserId = payload.me.id;

  return {
    now: asNumber(payload.now, Date.now()),
    roundStartedAt: asNumber(payload.roundStartedAt, Date.now()),
    coin: asNumber(payload.me.coin),
    buildings: payload.buildings.map((building) => ({
      id: asNumber(building.slot),
      name: building.name,
      icon: templates[building.slot - 1]?.icon ?? "🏠",
      cost: asNumber(building.cost),
      duration: asNumber(building.duration),
      status: building.status,
      startedAt: building.startedAt === null ? null : asNumber(building.startedAt),
      finishesAt: building.finishesAt === null ? null : asNumber(building.finishesAt),
      shieldUntil: building.shieldUntil === null ? null : asNumber(building.shieldUntil),
    })),
    missiles: payload.missiles.map((missile) => ({
      id: missile.id,
      from: missile.fromId === currentUserId ? "Bạn" : missile.fromName,
      to: missile.toId === currentUserId ? "Bạn" : missile.toName,
      launchedAt: asNumber(missile.launchedAt),
      arrivesAt: asNumber(missile.arrivesAt),
      targetBuildingId: 0,
      status: missile.status,
    })),
    players: payload.players.map((player) => mapPlayer(player, currentUserId)),
    islandShieldUntil:
      payload.me.islandShieldUntil === null ? null : asNumber(payload.me.islandShieldUntil),
    dailyRewardDate: payload.me.dailyRewardDate,
    events: payload.events.map((event) => ({
      ...event,
      at: asNumber(event.at),
    })),
    round: asNumber(payload.round, 1),
    winner: payload.winner,
    winnerRound: payload.winnerRound === null ? null : asNumber(payload.winnerRound),
    lastSavedAt: asNumber(payload.lastSavedAt, Date.now()),
    room: payload.room
      ? {
          ...payload.room,
          memberCount: asNumber(payload.room.memberCount),
          maxPlayers: asNumber(payload.room.maxPlayers, 12),
        }
      : null,
    myRooms: (payload.myRooms ?? []).map((room) => ({
      ...room,
      memberCount: asNumber(room.memberCount),
      maxPlayers: asNumber(room.maxPlayers, 12),
    })),
    joinRequests: (payload.joinRequests ?? []).map((request) => ({
      ...request,
      createdAt: asNumber(request.createdAt),
    })),
  };
}

async function runAction(action: MultiplayerAction): Promise<GameState> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");

  const { data, error } = await supabase.rpc(action.name, action.args);
  if (error) {
    const message = error.message.includes("Could not find the function")
      ? "Chưa cài migration multiplayer trong Supabase."
      : error.message;
    throw new Error(message);
  }

  return mapCloudState(data as CloudState);
}

export function fetchMultiplayerState() {
  return runAction({ name: "game_get_state" });
}

export function startCloudBuild(slot: number) {
  return runAction({ name: "game_start_build", args: { p_slot: slot } });
}

export function shieldCloudBuilding(slot: number) {
  return runAction({ name: "game_shield_building", args: { p_slot: slot } });
}

export function shieldCloudIsland() {
  return runAction({ name: "game_shield_island" });
}

export function launchCloudMissile(targetUserId: string) {
  return runAction({ name: "game_launch_missile", args: { p_target_user: targetUserId } });
}

export function claimCloudDailyReward() {
  return runAction({ name: "game_claim_daily_reward" });
}

export function createCloudRoom(name: string, joinPolicy: JoinPolicy) {
  return runAction({ name: "game_create_room", args: { p_name: name, p_join_policy: joinPolicy } });
}

export async function joinCloudRoom(code: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  const { data, error } = await supabase.rpc("game_join_room", { p_code: code });
  if (error) throw new Error(error.message);
  const result = data as JoinRoomResult;
  return { status: result.status, state: mapCloudState(result.state) };
}

export function selectCloudRoom(code: string) {
  return runAction({ name: "game_select_room", args: { p_code: code } });
}

export function reviewCloudJoinRequest(requestId: string, approve: boolean) {
  return runAction({
    name: "game_review_join_request",
    args: { p_request_id: requestId, p_approve: approve },
  });
}

export function updateCloudJoinPolicy(joinPolicy: JoinPolicy) {
  return runAction({ name: "game_update_join_policy", args: { p_join_policy: joinPolicy } });
}

export async function hasAuthenticatedPlayer() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.user);
}

export function subscribeToMultiplayer(onChange: () => void): RealtimeChannel | null {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const channel = supabase
    .channel(`goldfinger-game-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "game_events" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "room_leaderboard" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "room_join_requests" }, onChange)
    .subscribe();

  return channel;
}

export async function unsubscribeFromMultiplayer(channel: RealtimeChannel | null) {
  const supabase = getSupabaseBrowserClient();
  if (supabase && channel) await supabase.removeChannel(channel);
}
