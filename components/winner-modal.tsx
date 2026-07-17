"use client";

import { useGame } from "@/components/game-provider";
import { GameButton } from "./game-button";
import { RotateCcw, Trophy } from "lucide-react";

export function WinnerModal() {
  const { state, newRound } = useGame();
  if (!state.winner) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Kết quả vòng chơi">
      <div className="winner-modal">
        <div className="winner-burst">★</div>
        <Trophy size={58} />
        <p>Vòng {state.round} hoàn tất</p>
        <h2>{state.winner} chiến thắng!</h2>
        <span>Thành tích đã được lưu. Bắt đầu cuộc đua mới thôi.</span>
        <GameButton tone="green" icon={<RotateCcw size={18} />} onClick={newRound}>Chơi vòng mới</GameButton>
      </div>
    </div>
  );
}
