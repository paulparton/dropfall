# Dropfall Arena — First Draft

This build is the first cohesive local-play draft of the Unreal rewrite. It is
intended for hands-on feel testing, not public distribution yet.

## Play loop

1. Start in a safe ready state; the AI cannot play the match without you.
2. Press Enter, Space, or Gamepad A for a short countdown.
3. Knock the opponent off the arena. First to three points wins.
4. After 30 seconds, **Sudden Drop** shrinks the platform until the round ends.
5. Press `R` after a match for an immediate rematch.

## Controls

Movement is camera-relative: up is always the top of the screen.

| Player | Move | Boost |
|--------|------|-------|
| P1 keyboard | WASD | Space |
| P1 controller | Left stick | Bottom face button / A |
| P2 keyboard | Arrow keys | Right Shift |
| P2 controller | Controller 2 left stick | Bottom face button / A |

- `Tab` toggles Rival AI / couch versus.
- `Q` cycles Rookie, Rival, and Ace AI.
- `R` resets and starts a new match countdown.

## Included first-draft systems

- Screen-relative movement and readable boost cooldowns.
- Speed-scaled collision knockback, boost light flare, and procedural combat tones.
- Ready, countdown, round, point, match-win, and rematch states.
- Three AI decision tiers using identical player physics.
- Local wins and best streaks saved separately for each AI tier.
- Single shared camera, keyboard, and two-controller couch play.
- Timed Sudden Drop platform shrink.
- Runtime arena/rules tuning structs and future authoritative-server seams.
- Monetization policy API that makes active-match ad placement invalid and paid
  entitlement suppress all placements.
- Automated contracts for camera-relative controls, combat tuning, and ads.

## Deliberately deferred

- Final characters, animation, music, environments, and accessibility menu.
- Front-end navigation and settings UI.
- Online services, ranked play, global leaderboard, and replay authority.
- Production ad/storefront SDKs and public packaging/signing.

These are the next-product layers; none should require discarding the gameplay
contracts established by this draft.
