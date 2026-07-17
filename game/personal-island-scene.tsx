"use client";

import { formatTime } from "@/lib/game-rules";
import type { Building } from "@/types/game";
import { motion } from "framer-motion";
import type { CSSProperties } from "react";

const SPRITE_POSITIONS = ["0%", "25%", "50%", "75%", "100%"];
const BUILDING_POSITIONS = [
  { id: 1, x: 49.5, y: 13.5, z: 18 },
  { id: 2, x: 32.7, y: 27.5, z: 22 },
  { id: 3, x: 66.2, y: 27.5, z: 23 },
  { id: 4, x: 51.2, y: 40.5, z: 28 },
  { id: 5, x: 21.8, y: 46.5, z: 30 },
  { id: 6, x: 74.8, y: 46.5, z: 31 },
  { id: 7, x: 29.2, y: 65.5, z: 35 },
  { id: 8, x: 65.2, y: 62.5, z: 36 },
  { id: 9, x: 42.4, y: 78.2, z: 40 },
  { id: 10, x: 57.4, y: 75.5, z: 41 },
] as const;

type Props = {
  buildings: Building[];
  now: number;
  islandShielded: boolean;
  selectedBuildingId: number | null;
  onSelectBuilding: (buildingId: number | null) => void;
  onBuild: (buildingId: number) => void;
  onShield: (buildingId: number) => void;
  isBusy: boolean;
  coin: number;
  activeBuilds: number;
};

export function PersonalIslandScene({
  buildings, now, islandShielded, selectedBuildingId, onSelectBuilding,
  onBuild, onShield, isBusy, coin, activeBuilds,
}: Props) {
  return (
    <section className="personal-scene" aria-label="Đảo cá nhân với 10 vị trí xây dựng">
      <div className="personal-ocean-layer" />
      <div className="personal-wave-layer" />
      <div className="personal-cloud cloud-left" />
      <div className="personal-cloud cloud-right" />

      <div className="personal-island-object">
        <img src="/personal-island.webp" alt="" draggable={false} fetchPriority="high" />
        {islandShielded && <span className="personal-island-shield" aria-label="Đảo đang được bảo vệ" />}

        <div className="personal-building-layer">
          {BUILDING_POSITIONS.map((position, index) => {
            const building = buildings[index];
            if (!building) return null;
            const remaining = building.finishesAt ? (building.finishesAt - now) / 1000 : 0;
            const progress = Math.max(4, 100 - (remaining / building.duration) * 100);
            const shielded = Boolean(building.shieldUntil && building.shieldUntil > now);
            const canBuild = ["ready", "destroyed"].includes(building.status) &&
              activeBuilds < 2 && coin >= building.cost;
            const selected = selectedBuildingId === building.id;
            const style = {
              "--building-x": `${position.x}%`,
              "--building-y": `${position.y}%`,
              "--building-z": position.z,
            } as CSSProperties;

            return (
              <div
                className={`personal-building-object ${building.status} ${selected ? "selected" : ""}`}
                style={style}
                key={building.id}
                data-testid={`scene-building-${building.id}`}
              >
                <motion.button
                  className="personal-building-hitbox"
                  onClick={() => onSelectBuilding(selected ? null : building.id)}
                  whileHover={{ scale: 1.05, y: -3 }}
                  whileTap={{ scale: .97 }}
                  transition={{ type: "spring", stiffness: 340, damping: 19 }}
                  aria-label={`${building.name}, vị trí ${building.id}`}
                >
                  {(building.status === "completed" || building.status === "building") && (
                    <span
                      className="personal-building-sprite"
                      style={{ backgroundPositionX: SPRITE_POSITIONS[Math.floor((building.id - 1) / 2)] }}
                    />
                  )}
                  {building.status === "building" && (
                    <>
                      <span className="construction-frame" />
                      <span className="construction-dust dust-a" />
                      <span className="construction-dust dust-b" />
                    </>
                  )}
                  {building.status === "destroyed" && (
                    <>
                      <span className="destroyed-rubble" />
                      <span className="damage-smoke smoke-a" />
                      <span className="damage-smoke smoke-b" />
                    </>
                  )}
                  {shielded && <span className="building-shield-bubble" />}
                  <span className="personal-slot-number">{building.id}</span>
                  {building.status === "building" && (
                    <span className="personal-build-timer">
                      <b>{formatTime(remaining)}</b>
                      <i><em style={{ width: `${progress}%` }} /></i>
                    </span>
                  )}
                  {building.status === "completed" && <span className="building-sparkle sparkle-a" />}
                  {building.status === "completed" && <span className="building-sparkle sparkle-b" />}
                </motion.button>

                {selected && (
                  <div className="building-radial-menu" data-testid="building-radial-menu">
                    {canBuild && (
                      <button
                        className="radial-action build"
                        onClick={() => onBuild(building.id)}
                        disabled={isBusy}
                        data-testid={`scene-build-${building.id}`}
                      >
                        <b>Xây</b><small>{building.cost} coin</small>
                      </button>
                    )}
                    {building.status === "completed" && (
                      <button
                        className="radial-action shield"
                        onClick={() => onShield(building.id)}
                        disabled={isBusy || shielded || coin < 2}
                        data-testid={`scene-shield-${building.id}`}
                      >
                        <b>Shield</b>
                        <small>{shielded ? formatTime((building.shieldUntil! - now) / 1000) : "2 coin"}</small>
                      </button>
                    )}
                    {building.status === "locked" && (
                      <span className="radial-locked">Hoàn thành cấp trước</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="personal-particle-layer" aria-hidden="true">
        <i className="personal-spark particle-one" />
        <i className="personal-spark particle-two" />
        <i className="personal-leaf leaf-one" />
        <i className="personal-leaf leaf-two" />
      </div>
    </section>
  );
}
