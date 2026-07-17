"use client";

import { useGame } from "@/components/game-provider";
import { Coins, Crosshair, Home, Map, Shield, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButton } from "./auth-button";

const links = [
  { href: "/", label: "Trung tâm", icon: Home },
  { href: "/island", label: "Đảo của tôi", icon: Map },
  { href: "/attack", label: "Tấn công", icon: Crosshair },
  { href: "/leaderboard", label: "Xếp hạng", icon: Trophy },
];

export function Navbar() {
  const pathname = usePathname();
  const { state, mode } = useGame();
  const shielded = Boolean(state.islandShieldUntil && state.islandShieldUntil > state.now);

  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="GoldFinger Island">
          <span className="brand-mark">GF</span>
          <span><b>GoldFinger</b><small>Island</small></span>
        </Link>
        <nav className="desktop-nav" aria-label="Điều hướng chính">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={pathname === href ? "nav-link active" : "nav-link"}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="top-stats">
          <span className={`connection-pill ${mode}`} title={mode === "online" ? "Đã kết nối Supabase Realtime" : "Chế độ chơi cục bộ"}>
            <i /> {mode === "online" ? "ONLINE" : mode === "loading" ? "..." : "DEMO"}
          </span>
          {shielded && <span className="shield-state" title="Đảo đang được bảo vệ"><Shield size={16} /> Đang thủ</span>}
          <span className="coin-badge" data-testid="coin-badge"><Coins size={19} /> {state.coin}</span>
          <AuthButton />
        </div>
      </header>
      <nav className="mobile-nav" aria-label="Điều hướng di động">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={pathname === href ? "mobile-link active" : "mobile-link"}>
            <Icon size={21} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
