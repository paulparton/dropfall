# Dropfall Arena — First Draft

This build is the first cohesive local-play draft of the Unreal rewrite. It is
intended for hands-on feel testing, not public distribution yet.

## Play loop

1. Choose Practice, Solo Ladder, or Couch Versus from match setup.
   Choose a map with `E` / right shoulder, and terrain rule with `F` / left shoulder.
2. Click Start, or press Enter, Space, or Gamepad A for a short countdown.
3. Knock the opponent off the arena. First to three points wins.
4. **Fall Away** flashes the next floor ring red for four seconds, then drops
   it at 30 seconds. Further rings fall every 14 seconds, including their
   supported obstacles. **Stable Arena** keeps the entire floor indefinitely.
5. Confirm results to rematch or advance to the next ladder opponent.

## Solo ladder and local leaderboard

Beat Rookie, Rival, then Ace in one run. Each opponent is a first-to-three
match. Losing a match ends the run; retry starts again at Rookie. Completed
runs rank by fewest rounds conceded, then fastest total active-play time.
Countdowns and results do not count toward time. The top five are saved on
this device alongside the existing per-tier wins and streaks.

Practice, couch matches, incomplete runs and abandoned runs do not enter the
ladder leaderboard. This is a local records board, not an online ranking.
Records are separate for each map and terrain rule. Previous prototype records
remain in the save's legacy board and are not mixed into these new boards.

## Maps and ramps

| Map | Size | Layout |
|-----|------|--------|
| Foundry | 16 x 16 metres | Pillars, angled barriers, two ramps |
| Crosswind | 24 x 16 metres | Long lanes, staggered cover, four ramps |
| Skyway | 32 x 24 metres | Wide run-ups, obstacle islands, six ramps |

Green ramps rise toward their gold lip. Build speed and boost up the slope to
launch; there is no separate jump button. Both players and bots use the same
physics. The camera fits the map while preserving screen-relative movement.

## Controls

Movement is camera-relative: up is always the top of the screen.

| Player | Move | Boost |
|--------|------|-------|
| P1 keyboard | WASD | Space |
| P1 controller | Left stick | Bottom face button / A |
| P2 keyboard | Arrow keys | Right Shift |
| P2 controller | Controller 2 left stick | Bottom face button / A |

- Setup: `Left` / `Right`, D-pad, `Tab`, or click a card to choose mode.
- Practice setup: `Q`, gamepad Y, or click the opponent panel to cycle difficulty.
- Setup map: `E`, right shoulder, or click the map panel.
- Setup terrain: `F`, left shoulder, or click the terrain panel.
- `Enter` / `Space` / gamepad A: start, advance, or replay at results.
- `R`: restart the match; in Solo Ladder, discard the run and start at Rookie.
- `M` / gamepad Start: return to setup (abandons any current run).
- Mode, difficulty, map and terrain changes are locked during a match and ladder run.

## Included first-draft systems

- Screen-relative movement and readable boost cooldowns.
- Speed-scaled collision knockback, boost light flare, and procedural combat tones.
- Ready, countdown, round, point, match-win, and rematch states.
- Three AI decision tiers using identical player physics.
- Local wins and best streaks saved separately for each AI tier.
- Three-stage solo runs, results flow and persistent top-five local leaderboard.
- Responsive mouse/keyboard/controller match setup and results screens.
- Single shared camera, keyboard, and two-controller couch play.
- Three authored maps with collision ramps, pillars and angled barriers.
- Optional warning-marked falling floor rings, or a completely stable floor.
- Runtime arena/rules tuning structs and future authoritative-server seams.
- Monetization policy API that makes active-match ad placement invalid and paid
  entitlement suppress all placements.
- Automated contracts for camera-relative controls, combat tuning, and ads.
- Automated ladder progression, ranking and save-format contracts.

## Verification limits

Editor and native Mac game targets compile, and all nine automated tests
pass. Setup, couch scoring/results/rematch, and arena presentation were checked
in PIE. Physical two-controller play, every native mouse target, and a complete
hands-on ladder run still need playtesting. The development preview is not a
cooked distribution build.
Map tests also exercise actual floor/ramp collision, collapse/reset, separate
leaderboards and a simulated boosted ramp trajectory beyond the launch lip.

## Deliberately deferred

- Final characters, animation, music, environments, and accessibility menu.
- Settings and accessibility UI.
- Online services, ranked play, global leaderboard, and replay authority.
- Production ad/storefront SDKs and public packaging/signing.

These are the next-product layers; none should require discarding the gameplay
contracts established by this draft.
