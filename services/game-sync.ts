import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { GameState, PersistedGame } from "@/types/game";

export async function loadCloudGame(): Promise<GameState | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("game_snapshots")
    .select("state")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error || !data?.state) return null;
  return data.state as GameState;
}

export async function saveCloudGame(state: GameState) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { now: _now, ...persisted } = state;

  await supabase.from("game_snapshots").upsert({
    user_id: auth.user.id,
    state: persisted satisfies PersistedGame,
    updated_at: new Date().toISOString(),
  });
}
