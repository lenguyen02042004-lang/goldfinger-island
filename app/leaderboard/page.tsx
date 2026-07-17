import { LeaderboardTable } from "@/components/leaderboard-table";
import { RoomRequired } from "@/components/room-required";
import { Medal, TimerReset, Trophy } from "lucide-react";

export default function LeaderboardPage() {
  return (
    <RoomRequired>
      <div className="page-shell inner-page">
      <header className="page-title-row">
        <div>
          <span className="eyebrow">Vinh danh nhà vô địch</span>
          <h1>Bảng xếp hạng của trận</h1>
          <p>Thành tích được giữ vĩnh viễn trong phòng này sau mỗi vòng reset.</p>
        </div>
      </header>
      <div className="achievement-strip">
        <div><Trophy size={24} /><span><b>Thắng vòng</b><small>Hoàn thành 10 công trình đầu tiên</small></span></div>
        <div><TimerReset size={24} /><span><b>Kỷ lục thời gian</b><small>Tính từ đầu đến cuối vòng</small></span></div>
        <div><Medal size={24} /><span><b>Thành tích vĩnh viễn</b><small>Không mất khi vòng mới bắt đầu</small></span></div>
      </div>
      <LeaderboardTable />
      </div>
    </RoomRequired>
  );
}
