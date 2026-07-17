"use client";

import { BuildingGrid } from "@/components/building-grid";
import { EventFeed } from "@/components/event-feed";
import { GameButton } from "@/components/game-button";
import { useGame } from "@/components/game-provider";
import { ISLAND_SHIELD_COST, formatTime } from "@/lib/game-rules";
import { Clock3, Construction, Shield, Target } from "lucide-react";
import Link from "next/link";
import { MissileAlert } from "./missile-alert";

export function IslandDashboard() {
  const { state, shieldAll, isBusy } = useGame();
  const active = state.buildings.filter((building) => building.status === "building").length;
  const complete = state.buildings.filter((building) => building.status === "completed").length;
  const shielded = Boolean(state.islandShieldUntil && state.islandShieldUntil > state.now);

  return (
    <div className="page-shell inner-page">
      <header className="page-title-row">
        <div>
          <span className="eyebrow">Căn cứ của bạn · Vòng {state.round}</span>
          <h1>Đảo Bình Minh</h1>
          <p>Hoàn thành từng cặp công trình để mở cấp tiếp theo.</p>
        </div>
        <div className="page-actions">
          <GameButton
            tone="blue"
            icon={<Shield size={18} />}
            onClick={shieldAll}
            disabled={isBusy || shielded || state.coin < ISLAND_SHIELD_COST}
            data-testid="shield-island"
          >
            {shielded ? `Còn ${formatTime((state.islandShieldUntil! - state.now) / 1000)}` : `Thủ toàn đảo · ${ISLAND_SHIELD_COST}`}
          </GameButton>
          <Link href="/attack"><GameButton tone="red" icon={<Target size={18} />}>Tấn công</GameButton></Link>
        </div>
      </header>

      <MissileAlert />

      <section className="island-status-strip">
        <div><Construction size={20} /><span><b>{active}/2</b> đang xây</span></div>
        <div><span className="mini-progress"><i style={{ width: `${complete * 10}%` }} /></span><span><b>{complete}/10</b> hoàn thành</span></div>
        <div><Clock3 size={20} /><span><b>{formatTime((state.now - state.roundStartedAt) / 1000)}</b> thời gian vòng</span></div>
      </section>

      <section className="island-board">
        <div className="island-board-top">
          <div><span className="eyebrow">Kế hoạch xây dựng</span><h2>10 công trình bắt buộc</h2></div>
          <p>Mỗi công trình bị phá phải xây lại từ đầu.</p>
        </div>
        <BuildingGrid />
      </section>

      <div className="single-column-feed"><EventFeed limit={6} /></div>
    </div>
  );
}
