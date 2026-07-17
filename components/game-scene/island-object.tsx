"use client";

import type { Building, Player } from "@/types/game";
import { motion } from "framer-motion";
import { Hammer } from "lucide-react";
import type { CSSProperties } from "react";
import {
  ISLAND_HEIGHT,
  ISLAND_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type IslandPosition,
} from "./world-config";

const SPRITE_POSITIONS = ["0%", "25%", "50%", "75%", "100%"];
const BUILDING_POINTS = [
  { x: 31, y: 35 }, { x: 42, y: 32 }, { x: 53, y: 32 }, { x: 64, y: 35 },
  { x: 35, y: 45 }, { x: 48, y: 44 }, { x: 61, y: 45 },
  { x: 41, y: 55 }, { x: 56, y: 55 },
  { x: 48, y: 65 },
];

function syntheticBuildings(completed: number): Array<Pick<Building, "status">> {
  return Array.from({ length: 10 }, (_, index) => ({
    status: index < completed ? "completed" : "locked",
  }));
}

type IslandObjectProps = {
  position: IslandPosition;
  player: Player | null;
  ownBuildings?: Building[];
  selected: boolean;
  onSelect: (playerId: string) => void;
};

export function IslandObject({
  position,
  player,
  ownBuildings,
  selected,
  onSelect,
}: IslandObjectProps) {
  const isOwn = player?.id === "you";
  const buildings = ownBuildings ?? syntheticBuildings(player?.buildings ?? 0);
  const style = {
    "--island-x": `${position.x}px`,
    "--island-y": `${position.y}px`,
    "--island-z": position.depth,
    left: `${(position.x / WORLD_WIDTH) * 100}%`,
    top: `${(position.y / WORLD_HEIGHT) * 100}%`,
    width: `${(ISLAND_WIDTH / WORLD_WIDTH) * 100}%`,
    height: `${(ISLAND_HEIGHT / WORLD_HEIGHT) * 100}%`,
  } as CSSProperties;

  return (
    <div
      className={`scene-island ${isOwn ? "own" : ""} ${selected ? "selected" : ""} ${player ? "" : "waiting"}`}
      style={style}
      data-island-id={position.id}
    >
      <motion.button
        className="island-hitbox"
        onClick={() => player && !isOwn && onSelect(player.id)}
        animate={selected ? { scale: 1.06, y: -6 } : { scale: 1, y: 0 }}
        whileHover={player ? { scale: 1.045, y: -4 } : undefined}
        whileTap={player ? { scale: .98 } : undefined}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        aria-label={player ? `Đảo của ${player.name}` : "Vị trí đang chờ người chơi"}
      >
        <img className="island-ground" src="/island-object-clean.png" alt="" draggable={false} />
        <span className="island-object-glow" />

        <span className="island-building-layer">
          {buildings.map((building, index) => {
            const visible = building.status === "completed" || building.status === "building";
            if (!visible) return null;
            const point = BUILDING_POINTS[index];
            return (
              <motion.span
                className={`scene-building ${building.status}`}
                key={index}
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  backgroundPositionX: SPRITE_POSITIONS[Math.floor(index / 2)],
                }}
                initial={ownBuildings ? { scale: 0, y: 10 } : false}
                animate={{ scale: 1, y: building.status === "building" ? [0, -2, 0] : 0 }}
                transition={{ type: "spring", bounce: .42, y: { duration: 1.1, repeat: Infinity } }}
              >
                {building.status === "building" && <Hammer size={11} />}
              </motion.span>
            );
          })}
        </span>
      </motion.button>

      <span className="scene-nameplate">
        <i>{position.id}</i>
        <b>{isOwn ? "Tôi (Bạn)" : player?.name ?? "Đang chờ"}</b>
      </span>
      <span className="scene-build-count">{player?.buildings ?? 0}/10</span>
    </div>
  );
}
