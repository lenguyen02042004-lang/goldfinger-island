"use client";

import { useGame } from "@/components/game-provider";
import { formatTime } from "@/lib/game-rules";
import { BellRing } from "lucide-react";

export function EventFeed({ limit = 5 }: { limit?: number }) {
  const { state } = useGame();
  return (
    <section className="panel event-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow"><BellRing size={15} /> Trực tiếp</span>
          <h2>Bản tin chiến sự</h2>
        </div>
      </div>
      <div className="event-list">
        {state.events.slice(0, limit).map((item) => (
          <div className={`event-item ${item.kind}`} key={item.id}>
            <span className="event-icon">{item.kind === "hit" ? "💥" : item.kind === "blocked" ? "🛡️" : item.kind === "build" ? "🔨" : item.kind === "reward" ? "🪙" : "🚀"}</span>
            <p>{item.message}<small>{formatTime((state.now - item.at) / 1000)} trước</small></p>
          </div>
        ))}
      </div>
    </section>
  );
}
