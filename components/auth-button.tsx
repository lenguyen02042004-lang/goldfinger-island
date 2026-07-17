"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { LogIn, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!configured) return <span className="demo-pill" title="Thêm khóa Supabase để bật đồng bộ">DEMO</span>;

  async function handleAuth() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    if (user) {
      await supabase.auth.signOut();
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  return (
    <button className="auth-button" onClick={handleAuth} title={user ? "Đăng xuất" : "Đăng nhập Google"}>
      {user ? <LogOut size={17} /> : <LogIn size={17} />}
      <span>{user ? user.user_metadata?.name?.split(" ")[0] ?? "Đăng xuất" : "Đăng nhập"}</span>
    </button>
  );
}
