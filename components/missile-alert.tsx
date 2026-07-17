"use client";

import { useGame } from "@/components/game-provider";
import { formatTime } from "@/lib/game-rules";
import { AlertTriangle, EyeOff, Rocket } from "lucide-react";

export function MissileAlert() {
  const { state } = useGame();
  const incoming = state.missiles.filter((missile) => missile.to === "Bạn" && missile.status === "flying");
  if (incoming.length === 0) return null;
  const nearest = [...incoming].sort((a, b) => a.arrivesAt - b.arrivesAt)[0];

  return (
    <section className="missile-alert" role="alert" data-testid="incoming-alert">
      <span className="alert-icon"><AlertTriangle size={23} /></span>
      <div>
        <b>Cảnh báo: {nearest.from} đang tấn công đảo của bạn!</b>
        <small><EyeOff size={14} /> Không rõ công trình mục tiêu</small>
      </div>
      <span className="alert-eta"><Rocket size={18} /> ETA {formatTime((nearest.arrivesAt - state.now) / 1000)}</span>
    </section>
  );
}
