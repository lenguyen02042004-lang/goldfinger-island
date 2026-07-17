"use client";

import { GameButton } from "@/components/game-button";
import { useGame } from "@/components/game-provider";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";

export function RoomRequired({ children }: { children: React.ReactNode }) {
  const { state, mode } = useGame();
  if (mode === "loading") return <div className="page-shell room-required">Đang tải trận...</div>;
  if (mode === "online" && !state.room) {
    return (
      <div className="page-shell room-required">
        <Users size={42} />
        <h1>Chưa chọn trận</h1>
        <p>Nhập mã mời hoặc tạo một trận mới tại Trung tâm.</p>
        <Link href="/"><GameButton tone="blue" icon={<ArrowLeft size={18} />}>Về Trung tâm</GameButton></Link>
      </div>
    );
  }
  return children;
}
