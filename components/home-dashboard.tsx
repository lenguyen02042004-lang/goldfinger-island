"use client";

import { AuthButton } from "@/components/auth-button";
import { GameButton } from "@/components/game-button";
import { useGame } from "@/components/game-provider";
import { RoomHub } from "@/components/room-hub";
import {
  BUILDING_SHIELD_COST,
  ISLAND_SHIELD_COST,
  MISSILE_COST,
  formatTime,
} from "@/lib/game-rules";
import type { Player } from "@/types/game";
import { motion } from "framer-motion";
import {
  Bell,
  Check,
  Clock3,
  Coins,
  HelpCircle,
  Lock,
  Radio,
  Rocket,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const WAITING_NAMES = [
  "Đang chờ", "Đang chờ", "Đang chờ", "Đang chờ",
  "Đang chờ", "Đang chờ", "Đang chờ", "Đang chờ",
  "Đang chờ", "Đang chờ", "Đang chờ", "Đang chờ",
];

const SPRITE_POSITIONS = ["0%", "25%", "50%", "75%", "100%"];

function spriteTier(completed: number) {
  if (completed <= 0) return -1;
  return Math.min(4, Math.floor((completed - 1) / 2));
}

function islandPoint(index: number) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: 118 + col * 243, y: 128 + row * 188 };
}

function missilePath(fromIndex: number, toIndex: number) {
  const from = islandPoint(Math.max(0, fromIndex));
  const to = islandPoint(Math.max(0, toIndex));
  const lift = Math.max(72, Math.abs(to.x - from.x) * 0.24);
  const controlX = (from.x + to.x) / 2;
  const controlY = Math.min(from.y, to.y) - lift;
  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
}

export function HomeDashboard() {
  const { state, mode, build, shieldAll, isBusy } = useGame();
  const [roomOpen, setRoomOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const currentPlayer = state.players.find((player) => player.id === "you") ?? state.players[0];
  const complete = state.buildings.filter((building) => building.status === "completed").length;
  const elapsed = (state.now - state.roundStartedAt) / 1000;
  const flying = state.missiles.filter((missile) => missile.status === "flying");

  const slots = useMemo(() => {
    const players: Array<Player | null> = [...state.players.slice(0, 12)];
    while (players.length < 12) players.push(null);
    return players;
  }, [state.players]);

  return (
    <div className="game-stage">
      <div className="rotate-device">
        <Rocket size={42} />
        <b>Xoay ngang để vào trận</b>
        <span>GoldFinger Island War được thiết kế cho màn hình landscape.</span>
      </div>

      <div className="game-world">
        <div className="ocean-shimmer" />
        <div className="floating-cloud cloud-a" />
        <div className="floating-cloud cloud-b" />

        <header className="war-topbar">
          <Link href="/" className="war-logo" aria-label="GoldFinger Island War">
            <span>GOLDFINGER</span>
            <small>ISLAND WAR</small>
          </Link>

          <Link href="/leaderboard" className="war-top-button">
            <Trophy size={27} />
            <span><small>Bảng</small><b>Xếp hạng</b></span>
          </Link>

          <div className="war-resource timer">
            <Clock3 size={27} />
            <span><small>Thời gian trận</small><b>{formatTime(elapsed)}</b></span>
          </div>

          <div className="war-resource coin">
            <Coins size={27} />
            <b>{state.coin.toLocaleString("vi-VN")}</b>
          </div>

          <div className="war-resource gem">
            <span className="gem-shape">◆</span>
            <b>0</b>
          </div>

          <button className="war-circle-button" title="Trợ giúp"><HelpCircle size={25} /></button>
          <button className="war-circle-button" title="Âm thanh"><Volume2 size={25} /></button>
          <button className="war-circle-button" title="Cài đặt"><Settings size={25} /></button>
          <AuthButton />
        </header>

        <button className="room-badge" onClick={() => setRoomOpen(true)} title="Quản lý trận">
          <Users size={16} />
          <span>{state.room?.name ?? "Chọn trận"}</span>
          <b>{state.room?.code ?? "------"}</b>
        </button>

        <main className="island-map" aria-label="Bản đồ 12 đảo">
          <div className="island-grid">
            {slots.map((player, index) => {
              const isOwn = player?.id === "you";
              const isSelected = player?.id === selectedPlayer;
              const tier = spriteTier(player?.buildings ?? 0);
              return (
                <motion.button
                  key={player?.id ?? `waiting-${index}`}
                  className={`map-island ${isOwn ? "own" : ""} ${isSelected ? "selected" : ""} ${player ? "" : "waiting"}`}
                  onClick={() => player && !isOwn && setSelectedPlayer(player.id)}
                  whileHover={player ? { y: -5, scale: 1.035 } : undefined}
                  whileTap={player ? { scale: 0.97 } : undefined}
                  transition={{ type: "spring", stiffness: 330, damping: 18 }}
                  aria-label={player ? `Đảo của ${player.name}` : "Vị trí đang chờ người chơi"}
                >
                  <span className="island-nameplate">
                    <i>{index + 1}</i>
                    <b>{isOwn ? "Tôi (Bạn)" : player?.name ?? WAITING_NAMES[index]}</b>
                  </span>
                  {tier >= 0 ? (
                    <motion.span
                      className="island-building-sprite"
                      style={{ backgroundPositionX: SPRITE_POSITIONS[tier] }}
                      initial={{ scale: 0.65, y: 12 }}
                      animate={{ scale: 1, y: [0, -2, 0] }}
                      transition={{ scale: { type: "spring", bounce: 0.45 }, y: { duration: 3.2, repeat: Infinity } }}
                    />
                  ) : (
                    <span className="island-silhouette">⌂</span>
                  )}
                  <span className="island-build-count">{player?.buildings ?? 0}/10</span>
                </motion.button>
              );
            })}
          </div>

          <svg className="missile-flight-layer" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
            {flying.map((missile) => {
              const fromIndex = slots.findIndex((player) => player && (player.name === missile.from || (missile.from === "Bạn" && player.id === "you")));
              const toIndex = slots.findIndex((player) => player && (player.name === missile.to || (missile.to === "Bạn" && player.id === "you")));
              const path = missilePath(fromIndex, toIndex);
              const duration = Math.max(1, (missile.arrivesAt - missile.launchedAt) / 1000);
              const elapsedFlight = Math.max(0, (state.now - missile.launchedAt) / 1000);
              return (
                <g key={missile.id}>
                  <path d={path} className="rocket-arc" />
                  <text className="flying-game-rocket" fontSize="34">
                    🚀
                    <animateMotion
                      path={path}
                      dur={`${duration}s`}
                      begin={`-${elapsedFlight}s`}
                      rotate="auto"
                      fill="freeze"
                    />
                  </text>
                </g>
              );
            })}
          </svg>
        </main>

        <aside className="war-radar">
          <div className="war-panel-title danger"><Radio size={19} /><b>LIVE RADAR</b><i /></div>
          <div className="war-radar-list">
            {flying.length === 0 && <div className="war-empty">Bầu trời đang yên tĩnh</div>}
            {flying.slice(0, 5).map((missile) => (
              <div className="war-radar-row" key={missile.id}>
                <Rocket size={19} />
                <b>{missile.from}</b>
                <span>→</span>
                <b>{missile.to}</b>
                <time>{formatTime((missile.arrivesAt - state.now) / 1000)}</time>
              </div>
            ))}
          </div>

          <div className="war-panel-title"><Bell size={18} /><b>Thông báo</b></div>
          <div className="war-event-list">
            {state.events.slice(0, 3).map((event) => (
              <div key={event.id}><b>{event.message}</b><small>{formatTime((state.now - event.at) / 1000)} trước</small></div>
            ))}
          </div>
        </aside>

        <section className="player-mini-card">
          <div className="war-panel-title green"><Sparkles size={18} /><b>Đảo của bạn</b></div>
          <div className="mini-player-body">
            <span
              className="mini-building-sprite"
              style={{ backgroundPositionX: SPRITE_POSITIONS[Math.max(0, spriteTier(complete))] }}
            />
            <div><b>{currentPlayer?.name ?? "Bạn"}</b><span><Trophy size={14} /> {currentPlayer?.wins ?? 0} trận thắng</span><span><Coins size={14} /> {state.coin} coin</span></div>
          </div>
        </section>

        <section className="building-dock">
          <div className="dock-title">10 công trình cần xây <span>{complete}/10</span></div>
          <div className="dock-buildings">
            {state.buildings.map((building, index) => {
              const tier = Math.floor(index / 2);
              const remaining = building.finishesAt ? (building.finishesAt - state.now) / 1000 : 0;
              return (
                <motion.button
                  key={building.id}
                  className={`dock-building ${building.status}`}
                  onClick={() => build(building.id)}
                  disabled={isBusy || !["ready", "destroyed"].includes(building.status)}
                  whileHover={["ready", "destroyed"].includes(building.status) ? { y: -5 } : undefined}
                  whileTap={["ready", "destroyed"].includes(building.status) ? { scale: 0.94 } : undefined}
                >
                  <i>{index + 1}</i>
                  <span className="dock-sprite" style={{ backgroundPositionX: SPRITE_POSITIONS[tier] }} />
                  {building.status === "completed" && <em><Check size={14} /></em>}
                  {building.status === "locked" && <em className="locked"><Lock size={13} /></em>}
                  {building.status === "building" && <time>{formatTime(remaining)}</time>}
                  <small>{building.cost}</small>
                </motion.button>
              );
            })}
          </div>
        </section>

        <section className="war-actions">
          <Link href="/attack" className="missile-launch-button">
            <motion.span animate={{ y: [0, -5, 0], rotate: [-2, 2, -2] }} transition={{ duration: 1.8, repeat: Infinity }}>
              <Rocket size={34} />
            </motion.span>
            <span><b>Bắn tên lửa</b><small><Coins size={14} /> {MISSILE_COST}</small></span>
          </Link>
          <button
            className="shield-action"
            onClick={shieldAll}
            disabled={isBusy || state.coin < ISLAND_SHIELD_COST}
          >
            <Shield size={24} />
            <span><b>Shield toàn đảo</b><small>{ISLAND_SHIELD_COST} coin</small></span>
          </button>
          <Link href="/island" className="shield-action house">
            <Shield size={22} />
            <span><b>Shield từng nhà</b><small>{BUILDING_SHIELD_COST} coin</small></span>
          </Link>
        </section>

        {selectedPlayer && (
          <motion.div className="target-toast" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <Rocket size={18} />
            <span>Mục tiêu: <b>{state.players.find((player) => player.id === selectedPlayer)?.name}</b></span>
            <Link href="/attack">Tấn công</Link>
            <button onClick={() => setSelectedPlayer(null)} title="Bỏ chọn"><X size={16} /></button>
          </motion.div>
        )}

        {(roomOpen || (mode === "online" && !state.room)) && (
          <div className="game-room-backdrop">
            <motion.div className="game-room-dialog" initial={{ scale: .9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              {state.room && <button className="game-room-close" onClick={() => setRoomOpen(false)} title="Đóng"><X size={22} /></button>}
              <RoomHub />
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
