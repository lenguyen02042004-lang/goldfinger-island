import type { Metadata } from "next";
import { GameProvider } from "@/components/game-provider";
import { Navbar } from "@/components/navbar";
import { WinnerModal } from "@/components/winner-modal";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoldFinger Island",
  description: "Xây đảo, phòng thủ và chinh phục bảng xếp hạng cùng đồng đội.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <GameProvider>
          <Navbar />
          <main>{children}</main>
          <WinnerModal />
        </GameProvider>
      </body>
    </html>
  );
}
