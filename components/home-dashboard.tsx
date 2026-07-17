"use client";

import { useGame } from "@/components/game-provider";
import { EventFeed } from "@/components/event-feed";
import { GameButton } from "@/components/game-button";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { RadarBoard } from "@/components/radar-board";
import { DAILY_REWARD, formatTime } from "@/lib/game-rules";
import { ArrowRight, CalendarCheck, Castle, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

export function HomeDashboard() {
  const { state, claimReward, isBusy } = useGame();
  const complete = state.buildings.filter((building) => building.status === "completed").length;
  const today = new Date(state.now).toISOString().slice(0, 10);
  const claimed = state.dailyRewardDate === today;
  const elapsed = (state.now - state.roundStartedAt) / 1000;

  return (
    <div className="page-shell home-page">
      <section className="hero-game">
        <div className="cloud cloud-one" />
        <div className="cloud cloud-two" />
        <div className="hero-copy">
          <span className="round-pill"><Sparkles size={16} /> Vòng {state.round} đang diễn ra</span>
          <h1>GoldFinger Island</h1>
          <p>Xây căn cứ, bật lá chắn và tạo những màn đấu trí vui hết cỡ cùng đồng đội.</p>
          <div className="hero-actions">
            <Link href="/island"><GameButton tone="orange" icon={<Castle size={20} />}>Vào đảo của tôi</GameButton></Link>
            <GameButton tone="white" icon={<CalendarCheck size={19} />} onClick={claimReward} disabled={isBusy || claimed}>
              {claimed ? "Đã điểm danh" : `Nhận ${DAILY_REWARD} coin`}
            </GameButton>
          </div>
          <div className="round-stats">
            <div><b>{complete}/10</b><span>Công trình</span></div>
            <div><b>{formatTime(elapsed)}</b><span>Thời gian</span></div>
            <div><b>{state.missiles.filter((item) => item.status === "flying").length}</b><span>Đang bay</span></div>
          </div>
        </div>
        <div className="next-section-peek"><ShieldCheck size={18} /> Radar chiến thuật đang hoạt động</div>
      </section>

      <div className="dashboard-grid">
        <RadarBoard />
        <EventFeed />
      </div>
      <div className="section-cta">
        <div><span className="eyebrow">Đường đua đang nóng lên</span><h2>Theo dõi thứ hạng của cả đội</h2></div>
        <Link href="/leaderboard" className="text-link">Xem đầy đủ <ArrowRight size={17} /></Link>
      </div>
      <LeaderboardTable compact />
    </div>
  );
}
