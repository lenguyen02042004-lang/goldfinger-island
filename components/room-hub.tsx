"use client";

import { GameButton } from "@/components/game-button";
import { useGame } from "@/components/game-provider";
import type { JoinPolicy } from "@/types/game";
import {
  Check,
  Clipboard,
  Copy,
  DoorOpen,
  Link2,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

export function RoomHub() {
  const {
    state,
    mode,
    isBusy,
    createRoom,
    joinRoom,
    selectRoom,
    reviewJoinRequest,
    updateJoinPolicy,
  } = useGame();
  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>("open");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const invitedCode = new URLSearchParams(window.location.search).get("room");
    if (invitedCode) setJoinCode(invitedCode.toUpperCase());
  }, []);

  function submitCreate(event: FormEvent) {
    event.preventDefault();
    createRoom(roomName, joinPolicy);
  }

  function submitJoin(event: FormEvent) {
    event.preventDefault();
    joinRoom(joinCode.trim().toUpperCase());
  }

  async function copyInvite() {
    if (!state.room) return;
    await navigator.clipboard.writeText(`${window.location.origin}/?room=${state.room.code}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (mode !== "online") {
    return (
      <section className="room-hub demo-room-hub">
        <div className="room-current">
          <span className="room-icon"><Users size={22} /></span>
          <div><small>Chế độ chơi thử</small><b>Phòng DEMO12</b></div>
          <span className="room-count">4/12</span>
        </div>
      </section>
    );
  }

  return (
    <section className={`room-hub ${state.room ? "has-room" : "room-lobby"}`} data-testid="room-hub">
      {state.room ? (
        <>
          <div className="room-current">
            <span className="room-icon"><Users size={22} /></span>
            <div>
              <small>Trận đang chơi</small>
              <b>{state.room.name}</b>
              <span className="room-code">Mã {state.room.code}</span>
            </div>
            <span className="room-count">{state.room.memberCount}/{state.room.maxPlayers}</span>
            <button className="room-icon-button" onClick={copyInvite} title="Sao chép link mời">
              {copied ? <Check size={19} /> : <Link2 size={19} />}
            </button>
          </div>

          <div className="room-tools">
            {state.room.isCreator && (
              <div className="policy-control" aria-label="Quyền tham gia">
                <button
                  className={state.room.joinPolicy === "open" ? "active" : ""}
                  onClick={() => updateJoinPolicy("open")}
                  disabled={isBusy}
                >
                  <DoorOpen size={16} /> Tự do
                </button>
                <button
                  className={state.room.joinPolicy === "approval" ? "active" : ""}
                  onClick={() => updateJoinPolicy("approval")}
                  disabled={isBusy}
                >
                  <LockKeyhole size={16} /> Cần duyệt
                </button>
              </div>
            )}
            <form className="quick-join" onSubmit={submitJoin}>
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="Nhập mã trận"
                maxLength={10}
                aria-label="Mã trận"
                required
              />
              <button type="submit" disabled={isBusy} title="Tham gia trận"><DoorOpen size={18} /></button>
            </form>
          </div>

          {state.myRooms.length > 1 && (
            <div className="my-room-list">
              <span>Các trận của tôi</span>
              {state.myRooms.map((room) => (
                <button
                  key={room.id}
                  className={room.id === state.room?.id ? "active" : ""}
                  onClick={() => selectRoom(room.code)}
                  disabled={isBusy || room.id === state.room?.id}
                >
                  {room.name} <small>{room.memberCount}/12</small>
                </button>
              ))}
            </div>
          )}

          {state.joinRequests.length > 0 && (
            <div className="join-request-list">
              <div className="request-title"><ShieldCheck size={17} /> Yêu cầu chờ duyệt</div>
              {state.joinRequests.map((request) => (
                <div className="join-request" key={request.id}>
                  <span><b>{request.userName}</b><small>{request.roomName}</small></span>
                  <button onClick={() => reviewJoinRequest(request.id, true)} title="Chấp nhận"><Check size={18} /></button>
                  <button onClick={() => reviewJoinRequest(request.id, false)} title="Từ chối"><X size={18} /></button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="room-lobby-grid">
          <div className="room-lobby-copy">
            <span className="room-icon large"><Users size={28} /></span>
            <span className="eyebrow">Tối đa 12 người</span>
            <h1>Chọn trận để bắt đầu</h1>
            <p>Tạo một trận mới hoặc nhập mã được bạn bè chia sẻ.</p>
          </div>

          <form className="room-form" onSubmit={submitCreate}>
            <div className="room-form-title"><Plus size={18} /> Tạo trận mới</div>
            <input
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder="Tên trận"
              minLength={3}
              maxLength={40}
              required
            />
            <div className="policy-control wide">
              <button type="button" className={joinPolicy === "open" ? "active" : ""} onClick={() => setJoinPolicy("open")}>
                <DoorOpen size={16} /> Tự do
              </button>
              <button type="button" className={joinPolicy === "approval" ? "active" : ""} onClick={() => setJoinPolicy("approval")}>
                <LockKeyhole size={16} /> Cần duyệt
              </button>
            </div>
            <GameButton tone="green" icon={<Plus size={18} />} type="submit" disabled={isBusy}>
              Tạo trận
            </GameButton>
          </form>

          <form className="room-form" onSubmit={submitJoin}>
            <div className="room-form-title"><Clipboard size={18} /> Tham gia bằng mã</div>
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="Ví dụ: A1B2C3"
              minLength={6}
              maxLength={10}
              required
            />
            <GameButton tone="blue" icon={<DoorOpen size={18} />} type="submit" disabled={isBusy}>
              Tham gia
            </GameButton>
          </form>
        </div>
      )}
      {copied && <span className="copy-confirm"><Copy size={14} /> Đã sao chép link mời</span>}
    </section>
  );
}
