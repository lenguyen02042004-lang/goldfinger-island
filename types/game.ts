export type BuildingStatus = "locked" | "ready" | "building" | "completed" | "destroyed";

export type Building = {
  id: number;
  name: string;
  icon: string;
  cost: number;
  duration: number;
  status: BuildingStatus;
  startedAt: number | null;
  finishesAt: number | null;
  shieldUntil: number | null;
};

export type MissileStatus = "flying" | "hit" | "blocked";

export type Missile = {
  id: string;
  from: string;
  to: string;
  launchedAt: number;
  arrivesAt: number;
  targetBuildingId: number;
  status: MissileStatus;
};

export type Player = {
  id: string;
  name: string;
  avatar: string;
  color: string;
  buildings: number;
  wins: number;
  bestTime: number | null;
};

export type GameEvent = {
  id: string;
  at: number;
  kind: "build" | "launch" | "hit" | "blocked" | "reward" | "win";
  message: string;
};

export type GameState = {
  now: number;
  roundStartedAt: number;
  coin: number;
  buildings: Building[];
  missiles: Missile[];
  players: Player[];
  islandShieldUntil: number | null;
  dailyRewardDate: string | null;
  events: GameEvent[];
  round: number;
  winner: string | null;
  winnerRound: number | null;
  lastSavedAt: number;
};

export type PersistedGame = Omit<GameState, "now">;
