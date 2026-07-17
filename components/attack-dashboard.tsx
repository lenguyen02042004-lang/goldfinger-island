"use client";

import { GameButton } from "@/components/game-button";
import { useGame } from "@/components/game-provider";
import { RadarBoard } from "@/components/radar-board";
import { MISSILE_COST, MISSILE_FLIGHT_SECONDS, MISSILE_LIMIT, formatTime } from "@/lib/game-rules";
import { EyeOff, Rocket, ShieldAlert, Timer, Users } from "lucide-react";
import { useState } from "react";

export function AttackDashboard() {
  const { state, launch } = useGame();
  const opponents = state.players.filter((player) => player.id !== "you");
  const [selected, setSelected] = useState(opponents[0]?.name ?? "");
  const active = state.missiles.filter((missile) => missile.from === "Bạn" && missile.status === "flying").length;
  const canLaunch = Boolean(selected) && active < MISSILE_LIMIT && state.coin >= MISSILE_COST;

  return (
    <div className="page-shell inner-page">
      <header className="page-title-row">
        <div>
          <span className="eyebrow">Phòng điều khiển</span>
          <h1>Chọn đảo mục tiêu</h1>
          <p>Đối thủ biết bạn đang tấn công, nhưng không biết công trình nào bị nhắm tới.</p>
        </div>
        <span className="rocket-capacity"><Rocket size={19} /> {active}/{MISSILE_LIMIT} tên lửa đang bay</span>
      </header>

      <div className="attack-layout">
        <section className="panel target-panel">
          <div className="panel-heading">
            <div><span className="eyebrow"><Users size={15} /> Đồng đội</span><h2>Chọn một người chơi</h2></div>
          </div>
          <div className="target-list">
            {opponents.map((player) => (
              <button
                key={player.id}
                className={selected === player.name ? "target-card selected" : "target-card"}
                onClick={() => setSelected(player.name)}
                data-testid={`target-${player.id}`}
              >
                <span className="player-avatar large" style={{ background: player.color }}>{player.avatar}</span>
                <span><b>{player.name}</b><small>{player.buildings}/10 công trình</small></span>
                <i>{selected === player.name ? "Đã chọn" : "Chọn"}</i>
              </button>
            ))}
          </div>
          <div className="launch-summary">
            <div><Rocket size={21} /><span><b>{MISSILE_COST} coin</b><small>Chi phí phóng</small></span></div>
            <div><Timer size={21} /><span><b>{formatTime(MISSILE_FLIGHT_SECONDS)}</b><small>Thời gian bay</small></span></div>
            <div><EyeOff size={21} /><span><b>Bí mật</b><small>Ô mục tiêu</small></span></div>
          </div>
          <GameButton
            tone="red"
            className="launch-button"
            icon={<Rocket size={21} />}
            disabled={!canLaunch}
            onClick={() => launch(selected)}
            data-testid="launch-missile"
          >
            Phóng đến đảo {selected}
          </GameButton>
          {!canLaunch && <p className="disabled-reason"><ShieldAlert size={15} /> {active >= MISSILE_LIMIT ? "Bạn đã đạt giới hạn tên lửa đang bay." : "Không đủ coin để phóng."}</p>}
        </section>
        <RadarBoard />
      </div>
    </div>
  );
}
