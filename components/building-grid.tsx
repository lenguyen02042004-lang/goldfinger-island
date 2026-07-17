"use client";

import { useGame } from "@/components/game-provider";
import { BUILDING_SHIELD_COST, BUILD_LIMIT, formatTime } from "@/lib/game-rules";
import { Coins, Hammer, LockKeyhole, Shield, Timer } from "lucide-react";
import { GameButton } from "./game-button";

export function BuildingGrid() {
  const { state, build, shield, isBusy } = useGame();
  const active = state.buildings.filter((building) => building.status === "building").length;

  return (
    <div className="building-grid">
      {state.buildings.map((building) => {
        const remaining = building.finishesAt ? (building.finishesAt - state.now) / 1000 : 0;
        const shielded = Boolean(building.shieldUntil && building.shieldUntil > state.now);
        const canBuild = ["ready", "destroyed"].includes(building.status) && active < BUILD_LIMIT && state.coin >= building.cost;
        return (
          <article className={`building-slot ${building.status}`} key={building.id} data-testid={`building-${building.id}`}>
            <span className="slot-number">{building.id}</span>
            {shielded && <span className="slot-shield"><Shield size={15} /> {formatTime((building.shieldUntil! - state.now) / 1000)}</span>}
            <div className="building-art" aria-hidden>
              {building.status === "locked" ? <LockKeyhole size={35} /> : building.status === "destroyed" ? "💥" : building.icon}
            </div>
            <h3>{building.name}</h3>
            {building.status === "building" ? (
              <>
                <div className="progress-track"><span style={{ width: `${Math.max(4, 100 - (remaining / building.duration) * 100)}%` }} /></div>
                <p className="slot-meta"><Timer size={15} /> {formatTime(remaining)}</p>
              </>
            ) : building.status === "completed" ? (
              <GameButton
                tone="blue"
                icon={<Shield size={16} />}
                onClick={() => shield(building.id)}
                disabled={isBusy || shielded || state.coin < BUILDING_SHIELD_COST}
                aria-label={`Bảo vệ ${building.name}`}
              >
                {shielded ? "Đã bảo vệ" : `${BUILDING_SHIELD_COST} coin`}
              </GameButton>
            ) : building.status === "locked" ? (
              <p className="slot-hint">Hoàn thành cấp trước</p>
            ) : (
              <GameButton
                tone={building.status === "destroyed" ? "red" : "green"}
                icon={<Hammer size={16} />}
                onClick={() => build(building.id)}
                disabled={isBusy || !canBuild}
                data-testid={`build-${building.id}`}
              >
                <Coins size={15} /> {building.cost} · {formatTime(building.duration)}
              </GameButton>
            )}
          </article>
        );
      })}
    </div>
  );
}
