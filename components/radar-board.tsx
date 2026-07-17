"use client";

import { useGame } from "@/components/game-provider";
import { formatTime } from "@/lib/game-rules";
import { Radio, Rocket } from "lucide-react";

export function RadarBoard({ compact = false }: { compact?: boolean }) {
  const { state } = useGame();
  const flying = state.missiles.filter((missile) => missile.status === "flying");

  return (
    <section className={`panel radar-panel ${compact ? "compact" : ""}`}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow"><Radio size={15} /> Radar toàn trận</span>
          <h2>Tên lửa đang bay</h2>
        </div>
        <span className="live-pill"><i /> LIVE</span>
      </div>
      <div className="radar-screen">
        <div className="radar-grid" />
        <div className="radar-sweep" />
        {flying.length === 0 ? (
          <div className="radar-empty">Bầu trời đang yên tĩnh</div>
        ) : (
          <div className="missile-list">
            {flying.slice(0, compact ? 2 : 4).map((missile) => {
              const total = missile.arrivesAt - missile.launchedAt;
              const elapsed = Math.max(0, state.now - missile.launchedAt);
              const progress = Math.min(100, (elapsed / total) * 100);
              return (
                <div className="missile-row" key={missile.id} data-testid="radar-missile">
                  <div className="island-dot attacker">{missile.from.slice(0, 1)}</div>
                  <div className="flight-path">
                    <span className="path-line" />
                    <Rocket className="flying-rocket" size={23} style={{ left: `calc(${progress}% - 12px)` }} />
                    <small>ETA {formatTime((missile.arrivesAt - state.now) / 1000)}</small>
                  </div>
                  <div className="island-dot defender">{missile.to.slice(0, 1)}</div>
                  <div className="flight-names"><b>{missile.from}</b><span>đến</span><b>{missile.to}</b></div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <p className="radar-note">Mục tiêu công trình được giữ bí mật cho đến khi va chạm.</p>
    </section>
  );
}
