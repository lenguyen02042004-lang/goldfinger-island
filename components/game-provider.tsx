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
import {
  claimCloudDailyReward,
  createCloudRoom,
  fetchMultiplayerState,
  hasAuthenticatedPlayer,
  joinCloudRoom,
  launchCloudMissile,
  reviewCloudJoinRequest,
  selectCloudRoom,
  shieldCloudBuilding,
  shieldCloudIsland,
  startCloudBuild,
  subscribeToMultiplayer,
  unsubscribeFromMultiplayer,
  updateCloudJoinPolicy,
} from "@/services/multiplayer";
import type { GameState, JoinPolicy, PersistedGame } from "@/types/game";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type GameMode = "loading" | "demo" | "online";

type GameContextValue = {
  state: GameState;
  mode: GameMode;
  isBusy: boolean;
  build: (id: number) => void;
  shield: (id: number) => void;
  shieldAll: () => void;
  launch: (playerId: string) => void;
  claimReward: () => void;
  newRound: () => void;
  createRoom: (name: string, joinPolicy: JoinPolicy) => void;
  joinRoom: (code: string) => void;
  selectRoom: (code: string) => void;
  reviewJoinRequest: (requestId: string, approve: boolean) => void;
  updateJoinPolicy: (joinPolicy: JoinPolicy) => void;
};

const GameContext = createContext<GameContextValue | null>(null);
const STORAGE_KEY = "goldfinger-island-v1";
const DISMISSED_WINNER_KEY = "goldfinger-dismissed-winner";

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [mode, setMode] = useState<GameMode>("loading");
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const stateRef = useRef(state);
  const modeRef = useRef<GameMode>("loading");
  const refreshInFlight = useRef(false);
  const refreshQueued = useRef<number | null>(null);
  const dismissedWinners = useRef<Set<string>>(new Set());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const applyCloudState = useCallback((next: GameState) => {
    const winnerKey = next.room && next.winnerRound
      ? `${next.room.id}:${next.winnerRound}`
      : null;
    if (winnerKey && dismissedWinners.current.has(winnerKey)) {
      next = { ...next, winner: null, winnerRound: null };
    }
    stateRef.current = next;
    setState((current) => (
      modeRef.current !== "online" || next.lastSavedAt >= current.lastSavedAt ? next : current
    ));
  }, []);

  const refreshCloud = useCallback(async () => {
    if (refreshInFlight.current || modeRef.current !== "online") return;
    refreshInFlight.current = true;
    try {
      applyCloudState(await fetchMultiplayerState());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể đồng bộ trò chơi.");
    } finally {
      refreshInFlight.current = false;
    }
  }, [applyCloudState]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        dismissedWinners.current = new Set(
          JSON.parse(localStorage.getItem(DISMISSED_WINNER_KEY) ?? "[]") as string[],
        );
      } catch {
        dismissedWinners.current = new Set();
      }

      if (await hasAuthenticatedPlayer()) {
        try {
          const cloudState = await fetchMultiplayerState();
          if (cancelled) return;
          applyCloudState(cloudState);
          setMode("online");
          return;
        } catch (error) {
          if (!cancelled) {
            setNotice(error instanceof Error ? error.message : "Không thể mở chế độ online.");
          }
        }
      }

      let localState: GameState | null = null;
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as PersistedGame;
          localState = {
            ...parsed,
            now: Date.now(),
            winnerRound: parsed.winnerRound ?? null,
          };
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      if (cancelled) return;
      if (localState) setState(tickGame(localState, Date.now()));
      setMode("demo");
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [applyCloudState]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setState((current) => {
        if (modeRef.current === "online") {
          const next = { ...current, now: Math.max(Date.now(), current.now + 1000) };
          stateRef.current = next;
          return next;
        }
        if (modeRef.current === "loading") return current;
        const next = tickGame(current, Math.max(Date.now(), current.now + 1000));
        stateRef.current = next;
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (mode !== "demo") return;
    const { now: _now, ...persisted } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }, [mode, state]);

  useEffect(() => {
    if (mode !== "online") return;

    const scheduleRefresh = () => {
      if (refreshQueued.current !== null) window.clearTimeout(refreshQueued.current);
      refreshQueued.current = window.setTimeout(() => void refreshCloud(), 250);
    };
    const channel = subscribeToMultiplayer(scheduleRefresh);
    const poll = window.setInterval(() => void refreshCloud(), 4000);

    return () => {
      window.clearInterval(poll);
      if (refreshQueued.current !== null) window.clearTimeout(refreshQueued.current);
      refreshQueued.current = null;
      void unsubscribeFromMultiplayer(channel);
    };
  }, [mode, refreshCloud]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const updateDemo = useCallback((fn: (current: GameState) => GameState) => {
    setState((current) => {
      const next = fn(current);
      stateRef.current = next;
      return next;
    });
  }, []);

  const runCloudAction = useCallback(async (action: () => Promise<GameState>) => {
    if (isBusy) return;
    setIsBusy(true);
    setNotice(null);
    try {
      applyCloudState(await action());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Thao tác chưa thực hiện được.");
      await refreshCloud();
    } finally {
      setIsBusy(false);
    }
  }, [applyCloudState, isBusy, refreshCloud]);

  useEffect(() => {
    window.render_game_to_text = () => {
      const current = stateRef.current;
      return JSON.stringify({
        coordinateSystem: "UI game; no world coordinates. Timers are seconds remaining.",
        mode: modeRef.current,
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
        room: current.room,
      });
    };
    window.advanceTime = (ms: number) => {
      if (modeRef.current === "online") {
        setState((current) => ({ ...current, now: current.now + ms }));
      } else {
        updateDemo((current) => tickGame(current, current.now + ms));
      }
    };
  }, [updateDemo]);

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
    mode,
    isBusy,
    build: (id) => {
      if (mode === "online") {
        void runCloudAction(() => startCloudBuild(id));
      } else if (mode === "demo") {
        updateDemo((current) => buildBuilding(current, id));
      }
    },
    shield: (id) => {
      if (mode === "online") {
        void runCloudAction(() => shieldCloudBuilding(id));
      } else if (mode === "demo") {
        updateDemo((current) => shieldBuilding(current, id));
      }
    },
    shieldAll: () => {
      if (mode === "online") {
        void runCloudAction(shieldCloudIsland);
      } else if (mode === "demo") {
        updateDemo(shieldIsland);
      }
    },
    launch: (playerId) => {
      if (mode === "online") {
        void runCloudAction(() => launchCloudMissile(playerId));
      } else if (mode === "demo") {
        void updateDemo((current) => launchMissile(current, playerId));
      }
    },
    claimReward: () => {
      if (mode === "online") {
        void runCloudAction(claimCloudDailyReward);
      } else if (mode === "demo") {
        updateDemo(claimDailyReward);
      }
    },
    newRound: () => {
      if (mode === "online") {
        const winnerRound = stateRef.current.winnerRound ?? 0;
        const roomId = stateRef.current.room?.id;
        if (winnerRound && roomId) {
          dismissedWinners.current.add(`${roomId}:${winnerRound}`);
          localStorage.setItem(DISMISSED_WINNER_KEY, JSON.stringify([...dismissedWinners.current]));
        }
        setState((current) => ({ ...current, winner: null, winnerRound: null }));
        void refreshCloud();
      } else if (mode === "demo") {
        updateDemo(resetRound);
      }
    },
    createRoom: (name, joinPolicy) => {
      if (mode === "online") void runCloudAction(() => createCloudRoom(name, joinPolicy));
    },
    joinRoom: (code) => {
      if (mode !== "online" || isBusy) return;
      setIsBusy(true);
      setNotice(null);
      void joinCloudRoom(code)
        .then((result) => {
          applyCloudState(result.state);
          setNotice(
            result.status === "joined"
              ? "Đã tham gia trận thành công."
              : "Đã gửi yêu cầu. Hãy chờ người tạo trận phê duyệt.",
          );
        })
        .catch((error) => setNotice(error instanceof Error ? error.message : "Không thể tham gia trận."))
        .finally(() => setIsBusy(false));
    },
    selectRoom: (code) => {
      if (mode === "online") void runCloudAction(() => selectCloudRoom(code));
    },
    reviewJoinRequest: (requestId, approve) => {
      if (mode === "online") {
        void runCloudAction(() => reviewCloudJoinRequest(requestId, approve));
      }
    },
    updateJoinPolicy: (joinPolicy) => {
      if (mode === "online") {
        void runCloudAction(() => updateCloudJoinPolicy(joinPolicy));
      }
    },
  }), [isBusy, mode, refreshCloud, runCloudAction, state, updateDemo]);

  return (
    <GameContext.Provider value={value}>
      {children}
      {notice && <div className="game-notice" role="status">{notice}</div>}
    </GameContext.Provider>
  );
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
