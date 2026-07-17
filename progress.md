Original prompt: Build the complete GoldFinger Island team-building web game: 10 required buildings, 1000 starting coins, maximum 2 concurrent builds, missiles, shields, public radar, persistent leaderboard, Supabase, Vercel, and GitHub. Bright 2D cartoon presentation.

## Locked MVP rules

- Starting balance: 1,000 coins.
- Daily reward: 20 coins.
- Win by completing all 10 buildings first.
- Maximum 2 buildings under construction at once.
- Buildings: 2 Tents (30 coins, 60s), 2 Wood Houses (55 coins, 90s), 2 Villas (85 coins, 120s), 2 Resorts (125 coins, 180s), 2 Castles (155 coins, 240s).
- Total construction cost: 900 coins.
- Minimum build time with two parallel slots: 690 seconds (11m30s).
- Missile: 5 coins, 3 minute flight, maximum 2 active per attacker.
- Successful unshielded hit rewards attacker 10 coins and destroys one completed target building.
- Per-building shield: 2 coins for 5 minutes.
- Whole-island shield: 15 coins for 5 minutes.
- Radar reveals attacker, defender, and ETA, but never the targeted building.
- Round winner receives a persistent win and best-time record; round state resets.

## Implementation notes

- Project started empty on 2026-07-17.
- Local demo mode must work without Supabase credentials.
- Supabase SQL schema and RLS policies will be included for production.
- Required test hooks: window.render_game_to_text() and window.advanceTime(ms).

## TODO

- [x] Scaffold Next.js 15 project.
- [x] Implement complete local demo gameplay.
- [x] Add Supabase integration, Google auth, cloud snapshots, and SQL schema.
- [x] Verify production build.
- [x] Verify build, shield, missile, win, reset, and leaderboard flows in Chrome.
- [x] Add responsive cartoon UI and deployment documentation.
- [x] Push to GitHub repository `lenguyen02042004-lang/goldfinger-island`.
- [x] Add real Supabase Project URL and Publishable key locally and to Vercel.
- [x] Run schema in the user's Supabase project (verified through Data API).
- [ ] Enable Google provider and configure production/local redirect URLs in Supabase Auth.
- [x] Connect and deploy Vercel project under team `le-nguyen2004`.
- [ ] Add Supabase environment values to Vercel after a Supabase project is created.

## Verification log

- `npm run build`: passed on 2026-07-17 with Next.js 15.5.20.
- `npm audit --omit=dev`: 0 vulnerabilities after applying the patched PostCSS override.
- Supabase project connected: `hylhekaryvwywjatbylm`; Publishable key supported with legacy anon-key fallback.
- Standard web-game Playwright client: island build and radar launch passed.
- Full browser flow: two concurrent builds, shielded incoming missile, outgoing missile reward, all 10 buildings, winner modal, round reset, and persistent win count passed.
- Desktop screenshots inspected; radar label overlap was fixed and rechecked.
