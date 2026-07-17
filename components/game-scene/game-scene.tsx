"use client";

import type { Building, Missile, Player } from "@/types/game";
import { IslandObject } from "./island-object";
import { MissileLayer } from "./missile-layer";
import { ISLAND_POSITIONS } from "./world-config";

type GameSceneProps = {
  players: Array<Player | null>;
  buildings: Building[];
  missiles: Missile[];
  now: number;
  selectedPlayer: string | null;
  onSelectPlayer: (playerId: string) => void;
};

export function GameScene({
  players,
  buildings,
  missiles,
  now,
  selectedPlayer,
  onSelectPlayer,
}: GameSceneProps) {
  return (
    <div className="scene-root" aria-label="Bản đồ thế giới 12 đảo">
      <div className="scene-ocean-layer" />
      <div className="scene-wave-layer" />

      <div className="scene-island-layer">
        {ISLAND_POSITIONS.map((position, index) => {
          const player = players[index];
          return (
            <IslandObject
              key={position.id}
              position={position}
              player={player}
              ownBuildings={player?.id === "you" ? buildings : undefined}
              selected={player?.id === selectedPlayer}
              onSelect={onSelectPlayer}
            />
          );
        })}
      </div>

      <MissileLayer missiles={missiles} players={players} now={now} />

      <div className="scene-particle-layer" aria-hidden="true">
        <i className="sea-spark spark-one" />
        <i className="sea-spark spark-two" />
        <i className="sea-spark spark-three" />
      </div>

      <div className="scene-weather-layer" aria-hidden="true">
        <span className="scene-cloud weather-cloud-one" />
        <span className="scene-cloud weather-cloud-two" />
        <span className="bird-flock">⌁⌁</span>
      </div>
    </div>
  );
}
