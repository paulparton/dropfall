# Phase 17 — implemented Arena increment

All Classic work is deferred by explicit user direction. Historical Classic
artifacts are preserved and listed in `../../CLASSIC-DEFERRED.md`.

## Delivered

- Practice AI, solo ladder and couch-versus match setup; clear result/retry flow.
- Rookie → Rival → Ace progression, run loss/retry/abandon rules, active-play
  timing and a top-five local leaderboard ranked by rounds conceded then time.
- Existing per-tier wins/streaks survive the expanded save format.
- Responsive Canvas menu/HUD, gamepad/keyboard navigation and queued pointer
  input. Menu mouse capture is separate from gameplay capture.
- Movement now derives from the real camera basis. The previous W/S mapping
  and test both used the wrong sign; tests now assert projected screen direction.
- Arena materials explicitly use the colour-capable shape material; newly added
  mesh roots receive their intended transforms. Edge accents track floor shrink.
- Editor asset-manager startup configuration for GameFeatureData.

## Evidence and limits

See `17-VERIFICATION.md`. Editor and Mac Game targets build; five automated
tests pass. PIE couch scoring/results/rematch and setup render were checked.
This is a playable development increment, not a cooked public release or a
claim that the whole Arena rewrite is polished and finished. Physical two-pad
play, all native mouse targets and a full hands-on ladder run remain follow-up.

No Classic runtime code or unrelated `outputs/` files were changed.
