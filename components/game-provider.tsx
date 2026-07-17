"use client";

import {
  buildBuilding,
  claimDailyReward,
  createInitialState,
  launchMissile,
  resetRound,
  shieldBuilding,
  shieldIsland,
  tickGame,
} from "@/lib/game-engine";
import type { GameState, PersistedGame } from "@/types/game";
import { loadCloudGame, saveCloudGame } from "@/services/game-sync";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type GameContextValue = {
  state: GameState;
  build: (id: number) => void;
  shield: (id: number) => void;
  shieldAll: () => void;
  launch: (name: string) => void;
  claimReward: () => void;
  newRound: () => void;
};

const GameContext = createContext<GameContextValue | null>(null);
const STORAGE_KEY = "goldfinger-island-v1";

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const hydrated = useRef(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    async function hydrate() {
      let localState: GameState | null = null;
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as PersistedGame;
          localState = { ...parsed, now: Date.now() };
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      const cloudState = await loadCloudGame();
      const newest = cloudState && (!localState || cloudState.lastSavedAt > localState.lastSavedAt) ? cloudState : localState;
      if (newest) setState(tickGame(newest, Date.now()));
      hydrated.current = true;
    }
    void hydrate();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(
      () => setState((current) => tickGame(current, Math.max(Date.now(), current.now + 1000))),
      1000,
    );
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const { now: _now, ...persisted } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    const timeout = window.setTimeout(() => void saveCloudGame(state), 1000);
    return () => window.clearTimeout(timeout);
  }, [state]);

  const update = useCallback((fn: (current: GameState) => GameState) => {
    setState((current) => {
      const next = fn(current);
      stateRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    window.render_game_to_text = () => {
      const current = stateRef.current;
      return JSON.stringify({
        coordinateSystem: "UI game; no world coordinates. Timers are seconds remaining.",
        round: current.round,
        coin: current.coin,
        winner: current.winner,
        buildings: current.buildings.map((building) => ({
          id: building.id,
          name: building.name,
          status: building.status,
          secondsRemaining: building.finishesAt ? Math.max(0, Math.ceil((building.finishesAt - current.now) / 1000)) : 0,
          shielded: Boolean(building.shieldUntil && building.shieldUntil > current.now),
        })),
        missiles: current.missiles.filter((missile) => missile.status === "flying").map((missile) => ({
          from: missile.from,
          to: missile.to,
          secondsRemaining: Math.max(0, Math.ceil((missile.arrivesAt - current.now) / 1000)),
        })),
        leaderboard: current.players.map((player) => ({
          name: player.name,
          wins: player.wins,
          bestTime: player.bestTime,
        })),
      });
    };
    window.advanceTime = (ms: number) => {
      update((current) => tickGame(current, current.now + ms));
    };
  }, [update]);

  useEffect(() => {
    function handleFullscreen(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "f") return;
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void document.documentElement.requestFullscreen();
      }
    }
    window.addEventListener("keydown", handleFullscreen);
    return () => window.removeEventListener("keydown", handleFullscreen);
  }, []);

  const value = useMemo<GameContextValue>(() => ({
    state,
    build: (id) => update((current) => buildBuilding(current, id)),
    shield: (id) => update((current) => shieldBuilding(current, id)),
    shieldAll: () => update(shieldIsland),
    launch: (name) => update((current) => launchMissile(current, name)),
    claimReward: () => update(claimDailyReward),
    newRound: () => update(resetRound),
  }), [state, update]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used inside GameProvider");
  return context;
}

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
  }
}
