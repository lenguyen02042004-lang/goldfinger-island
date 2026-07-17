"use client";

import { useGame } from "@/components/game-provider";
import { PersonalIslandScene } from "@/game/personal-island-scene";
import { PersonalIslandHud } from "@/ui/personal-island-hud";
import { Rocket } from "lucide-react";
import { useState } from "react";

export function IslandDashboard() {
  const { state, build, shield, shieldAll, isBusy } = useGame();
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const active = state.buildings.filter((building) => building.status === "building").length;
  const shielded = Boolean(state.islandShieldUntil && state.islandShieldUntil > state.now);

  return (
    <div className="personal-game-stage">
      <div className="personal-rotate-device">
        <Rocket size={43} />
        <b>Xoay ngang để quản lý đảo</b>
        <span>Đảo cá nhân được thiết kế cho màn hình landscape.</span>
      </div>
      <div className="personal-game-world">
        <PersonalIslandScene
          buildings={state.buildings}
          now={state.now}
          islandShielded={shielded}
          selectedBuildingId={selectedBuildingId}
          onSelectBuilding={setSelectedBuildingId}
          onBuild={build}
          onShield={shield}
          isBusy={isBusy}
          coin={state.coin}
          activeBuilds={active}
        />
        <PersonalIslandHud
          state={state}
          selectedBuildingId={selectedBuildingId}
          onSelectBuilding={setSelectedBuildingId}
          onShieldAll={shieldAll}
          isBusy={isBusy}
        />
      </div>
    </div>
  );
}
