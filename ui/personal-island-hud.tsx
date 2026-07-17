"use client";

import { AuthButton } from "@/components/auth-button";
import { BUILDING_SHIELD_COST, ISLAND_SHIELD_COST, formatTime } from "@/lib/game-rules";
import type { GameState } from "@/types/game";
import {
  Clock3, Coins, HelpCircle, Radio, Rocket, Settings, Shield, Trophy, Volume2,
} from "lucide-react";
import Link from "next/link";

const SPRITE_POSITIONS = ["0%", "25%", "50%", "75%", "100%"];

type Props = {
  state: GameState;
  selectedBuildingId: number | null;
  onSelectBuilding: (buildingId: number) => void;
  onShieldAll: () => void;
  isBusy: boolean;
};

export function PersonalIslandHud({
  state, selectedBuildingId, onSelectBuilding, onShieldAll, isBusy,
}: Props) {
  const elapsed = (state.now - state.roundStartedAt) / 1000;
  const complete = state.buildings.filter((building) => building.status === "completed").length;
  const player = state.players.find((candidate) => candidate.id === "you") ?? state.players[0];
  const flying = state.missiles.filter((missile) => missile.status === "flying");
  const islandShielded = Boolean(state.islandShieldUntil && state.islandShieldUntil > state.now);

  return (
    <div className="personal-hud-layer">
      <header className="personal-topbar">
        <Link href="/" className="personal-logo" aria-label="Về bản đồ chính">
          <span>GOLDFINGER</span><small>ISLAND WAR</small>
        </Link>
        <Link href="/leaderboard" className="personal-top-button">
          <Trophy size={27} /><span><small>Bảng</small><b>Xếp hạng</b></span>
        </Link>
        <div className="personal-resource timer">
          <Clock3 size={28} /><span><small>Thời gian trận</small><b>{formatTime(elapsed)}</b></span>
        </div>
        <div className="personal-resource coin">
          <Coins size={28} /><b>{state.coin.toLocaleString("vi-VN")}</b>
        </div>
        <div className="personal-resource gem"><i>◆</i><b>0</b></div>
        <button className="personal-circle-button" title="Cài đặt"><Settings size={25} /></button>
        <button className="personal-circle-button" title="Âm thanh"><Volume2 size={25} /></button>
        <button className="personal-circle-button" title="Trợ giúp"><HelpCircle size={25} /></button>
        <AuthButton />
      </header>

      <div className="personal-island-banner">
        <i>{Math.max(1, state.players.findIndex((candidate) => candidate.id === player?.id) + 1)}</i>
        <b>TÔI (BẠN)</b>
      </div>

      <aside className="personal-radar">
        <div className="personal-panel-title"><Radio size={18} /><b>LIVE RADAR</b><i /></div>
        <div className="personal-radar-list">
          {flying.length === 0 && <span className="personal-radar-empty">Bầu trời đang yên tĩnh</span>}
          {flying.slice(0, 5).map((missile) => (
            <div className="personal-radar-row" key={missile.id}>
              <Rocket size={18} /><b>{missile.from}</b><span>→</span><b>{missile.to}</b>
              <time>{formatTime((missile.arrivesAt - state.now) / 1000)}</time>
            </div>
          ))}
        </div>
      </aside>

      <aside className="personal-legend">
        <b>5 LOẠI NHÀ</b>
        {["Tent", "Wood House", "Villa", "Resort", "Castle"].map((name, index) => (
          <div key={name}>
            <span className="legend-building" style={{ backgroundPositionX: SPRITE_POSITIONS[index] }} />
            <span>{index + 1}. {name}</span>
          </div>
        ))}
      </aside>

      <aside className="personal-player-card">
        <div className="player-avatar">{player?.name?.slice(0, 1).toUpperCase() ?? "B"}</div>
        <div>
          <b>{player?.name ?? "Bạn"}</b>
          <span><Coins size={15} /> {state.coin.toLocaleString("vi-VN")}</span>
          <span><Trophy size={15} /> {player?.wins ?? 0} trận thắng</span>
        </div>
        <Link href="/leaderboard">Hồ sơ</Link>
      </aside>

      <section className="personal-building-dock">
        <div className="personal-dock-title">
          <b>10 CÔNG TRÌNH CẦN XÂY</b><span>{complete}/10</span>
        </div>
        <div className="personal-dock-slots">
          {state.buildings.map((building) => {
            const remaining = building.finishesAt ? (building.finishesAt - state.now) / 1000 : 0;
            return (
              <button
                className={`personal-dock-slot ${building.status} ${selectedBuildingId === building.id ? "selected" : ""}`}
                key={building.id}
                onClick={() => onSelectBuilding(building.id)}
                data-testid={`island-dock-${building.id}`}
              >
                <i>{building.id}</i>
                <span
                  className="personal-dock-sprite"
                  style={{ backgroundPositionX: SPRITE_POSITIONS[Math.floor((building.id - 1) / 2)] }}
                />
                {building.status === "building" && <time>{formatTime(remaining)}</time>}
                {building.status === "completed" && <em>Hoàn thành</em>}
                {building.status === "locked" && <small>Khóa</small>}
              </button>
            );
          })}
        </div>
        <div className="personal-building-costs">
          <span>1-2 Lều <b>30</b></span><span>3-4 Nhà gỗ <b>55</b></span>
          <span>5-6 Villa <b>85</b></span><span>7-8 Resort <b>125</b></span>
          <span>9-10 Castle <b>155</b></span>
        </div>
      </section>

      <div className="personal-actions">
        <Link href="/attack" className="personal-missile-button">
          <Rocket size={37} /><span><b>Bắn tên lửa</b><small><Coins size={14} /> 5</small></span>
        </Link>
        <div className="personal-defense">
          <b>Phòng thủ</b>
          <button disabled><Shield size={20} /><span>Shield nhà<small>{BUILDING_SHIELD_COST} coin</small></span></button>
          <button
            onClick={onShieldAll}
            disabled={isBusy || islandShielded || state.coin < ISLAND_SHIELD_COST}
            data-testid="shield-island"
          >
            <Shield size={20} />
            <span>Shield toàn đảo<small>{islandShielded ? formatTime((state.islandShieldUntil! - state.now) / 1000) : `${ISLAND_SHIELD_COST} coin`}</small></span>
          </button>
        </div>
      </div>
    </div>
  );
}
