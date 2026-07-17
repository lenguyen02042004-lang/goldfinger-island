import type { Building } from "@/types/game";

export const STARTING_COIN = 1000;
export const DAILY_REWARD = 20;
export const BUILD_LIMIT = 2;
export const MISSILE_COST = 5;
export const MISSILE_REWARD = 10;
export const MISSILE_FLIGHT_SECONDS = 180;
export const MISSILE_LIMIT = 2;
export const BUILDING_SHIELD_COST = 2;
export const ISLAND_SHIELD_COST = 15;
export const SHIELD_SECONDS = 300;

const BLUEPRINTS = [
  { name: "Lều thám hiểm", icon: "⛺", cost: 30, duration: 60 },
  { name: "Lều thám hiểm", icon: "⛺", cost: 30, duration: 60 },
  { name: "Nhà gỗ", icon: "🛖", cost: 55, duration: 90 },
  { name: "Nhà gỗ", icon: "🛖", cost: 55, duration: 90 },
  { name: "Biệt thự", icon: "🏡", cost: 85, duration: 120 },
  { name: "Biệt thự", icon: "🏡", cost: 85, duration: 120 },
  { name: "Khu nghỉ dưỡng", icon: "🏨", cost: 125, duration: 180 },
  { name: "Khu nghỉ dưỡng", icon: "🏨", cost: 125, duration: 180 },
  { name: "Lâu đài", icon: "🏰", cost: 155, duration: 240 },
  { name: "Lâu đài", icon: "🏰", cost: 155, duration: 240 },
] as const;

export function createBuildings(): Building[] {
  return BLUEPRINTS.map((building, index) => ({
    id: index + 1,
    ...building,
    status: index < 2 ? "ready" : "locked",
    startedAt: null,
    finishesAt: null,
    shieldUntil: null,
  }));
}

export function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
