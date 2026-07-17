"use client";

import { GameButton } from "@/components/game-button";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Eye, EyeOff, LogIn, LogOut, UserPlus, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type AuthMode = "login" | "register";

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage(null);
  }

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.reload();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setSubmitting(true);
    setMessage(null);

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: displayName.trim() || email.split("@")[0] },
        },
      });

      if (error) {
        setMessage({ tone: "error", text: error.message });
      } else if (!data.session) {
        setMessage({
          tone: "error",
          text: "Supabase đang bật xác nhận email. Hãy tắt Confirm email trong Auth Settings.",
        });
      } else {
        setMessage({ tone: "success", text: "Tạo tài khoản thành công. Đang vào đảo..." });
        window.setTimeout(() => window.location.reload(), 700);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage({ tone: "error", text: "Email hoặc mật khẩu chưa đúng." });
      } else {
        setMessage({ tone: "success", text: "Đăng nhập thành công. Đang tải đảo..." });
        window.setTimeout(() => window.location.reload(), 700);
      }
    }

    setSubmitting(false);
  }

  if (!configured) return <span className="demo-pill" title="Thêm khóa Supabase để bật đồng bộ">DEMO</span>;

  if (user) {
    const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "Người chơi";
    return (
      <button className="auth-button signed-in" onClick={handleSignOut} title="Đăng xuất">
        <span className="auth-avatar">{name.slice(0, 1).toUpperCase()}</span>
        <span>{name}</span>
        <LogOut size={16} />
      </button>
    );
  }

  return (
    <>
      <button className="auth-button" onClick={() => setOpen(true)} title="Đăng nhập" data-testid="auth-open">
        <LogIn size={17} />
        <span>Đăng nhập</span>
      </button>

      {open && (
        <div className="auth-backdrop" role="dialog" aria-modal="true" aria-label="Tài khoản người chơi">
          <section className="auth-modal" data-testid="auth-modal">
            <button className="auth-close" onClick={() => setOpen(false)} title="Đóng" aria-label="Đóng">
              <X size={20} />
            </button>
            <span className="auth-emblem">{mode === "login" ? <LogIn size={25} /> : <UserPlus size={25} />}</span>
            <h2>{mode === "login" ? "Chào mừng trở lại" : "Tạo người chơi mới"}</h2>

            <div className="auth-segments" role="tablist" aria-label="Chế độ tài khoản">
              <button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")} role="tab">
                Đăng nhập
              </button>
              <button
                className={mode === "register" ? "active" : ""}
                onClick={() => switchMode("register")}
                role="tab"
                data-testid="auth-mode-register"
              >
                Đăng ký
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {mode === "register" && (
                <label>
                  <span>Tên hiển thị</span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Ví dụ: Minh"
                    maxLength={30}
                    required
                  />
                </label>
              )}
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ban@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                <span>Mật khẩu</span>
                <div className="password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              {message && <p className={`auth-message ${message.tone}`}>{message.text}</p>}

              <GameButton
                tone={mode === "login" ? "blue" : "green"}
                icon={mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
                disabled={submitting}
                type="submit"
                data-testid="auth-submit"
              >
                {submitting ? "Đang xử lý..." : mode === "login" ? "Vào đảo" : "Tạo tài khoản"}
              </GameButton>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
