import { LeaderboardTable } from "@/components/leaderboard-table";
import { Medal, TimerReset, Trophy } from "lucide-react";

export default function LeaderboardPage() {
  return (
    <div className="page-shell inner-page">
      <header className="page-title-row">
        <div>
          <span className="eyebrow">Vinh danh nhà vô địch</span>
          <h1>Bảng xếp hạng toàn đội</h1>
          <p>Số trận thắng và kỷ lục được giữ lại sau mỗi lần đảo được xây mới.</p>
        </div>
      </header>
      <div className="achievement-strip">
        <div><Trophy size={24} /><span><b>Thắng vòng</b><small>Hoàn thành 10 công trình đầu tiên</small></span></div>
        <div><TimerReset size={24} /><span><b>Kỷ lục thời gian</b><small>Tính từ đầu đến cuối vòng</small></span></div>
        <div><Medal size={24} /><span><b>Thành tích vĩnh viễn</b><small>Không mất khi vòng mới bắt đầu</small></span></div>
      </div>
      <LeaderboardTable />
    </div>
  );
}
