"use client";

import { useGame } from "@/components/game-provider";
import { formatTime } from "@/lib/game-rules";
import { Crown, Trophy } from "lucide-react";

export function LeaderboardTable({ compact = false }: { compact?: boolean }) {
  const { state } = useGame();
  const ranked = [...state.players].sort((a, b) => b.wins - a.wins || (a.bestTime ?? Infinity) - (b.bestTime ?? Infinity));
  return (
    <section className="panel leaderboard-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow"><Trophy size={15} /> Thành tích vĩnh viễn</span>
          <h2>Bảng xếp hạng</h2>
        </div>
      </div>
      <div className="leaderboard-list">
        {ranked.slice(0, compact ? 4 : ranked.length).map((player, index) => (
          <div className={`leader-row rank-${index + 1}`} key={player.id}>
            <span className="rank">{index === 0 ? <Crown size={22} /> : `#${index + 1}`}</span>
            <span className="player-avatar" style={{ background: player.color }}>{player.avatar}</span>
            <span className="player-name"><b>{player.name}</b><small>{player.buildings}/10 công trình vòng này</small></span>
            <span className="wins"><b>{player.wins}</b><small>trận thắng</small></span>
            {!compact && <span className="best"><b>{player.bestTime ? formatTime(player.bestTime) : "--:--"}</b><small>nhanh nhất</small></span>}
          </div>
        ))}
      </div>
    </section>
  );
}
