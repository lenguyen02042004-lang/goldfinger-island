"use client";

import type { Missile, Player } from "@/types/game";
import { islandCenter } from "./world-config";

function routeForMissile(missile: Missile, players: Array<Player | null>) {
  const fromIndex = players.findIndex(
    (player) => player && (player.name === missile.from || (missile.from === "Bạn" && player.id === "you")),
  );
  const toIndex = players.findIndex(
    (player) => player && (player.name === missile.to || (missile.to === "Bạn" && player.id === "you")),
  );
  const from = islandCenter(fromIndex);
  const to = islandCenter(toIndex);
  const controlX = (from.x + to.x) / 2;
  const controlY = Math.min(from.y, to.y) - Math.max(110, Math.abs(to.x - from.x) * .3);
  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
}

export function MissileLayer({
  missiles,
  players,
  now,
}: {
  missiles: Missile[];
  players: Array<Player | null>;
  now: number;
}) {
  return (
    <svg className="scene-missile-layer" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true">
      {missiles.map((missile) => {
        const path = routeForMissile(missile, players);
        const duration = Math.max(1, (missile.arrivesAt - missile.launchedAt) / 1000);
        const elapsed = Math.max(0, (now - missile.launchedAt) / 1000);
        return (
          <g key={missile.id}>
            <path d={path} className="scene-rocket-arc" />
            <circle r="7" className="rocket-smoke">
              <animateMotion path={path} dur={`${duration}s`} begin={`-${Math.max(0, elapsed - 1)}s`} fill="freeze" />
            </circle>
            <text className="scene-flying-rocket" fontSize="42">
              🚀
              <animateMotion
                path={path}
                dur={`${duration}s`}
                begin={`-${elapsed}s`}
                rotate="auto"
                fill="freeze"
              />
            </text>
          </g>
        );
      })}
    </svg>
  );
}
