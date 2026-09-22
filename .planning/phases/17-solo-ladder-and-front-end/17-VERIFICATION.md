---
status: human_needed
verified: 2026-09-22
---

# Phase 17 verification

Scope: Unreal Arena only. Classic work is deferred; no Classic runtime files
were changed. Earlier milestone claims are not substituted for these checks.

## Automated

Headless Unreal automation ran five tests successfully on 2026-09-22:

- `DropfallArena.Input.ScreenRelativeMapping`: W/S and D project in the correct
  screen direction through the actual shared-camera basis; diagonals are bounded.
- `DropfallArena.Combat.DefaultTuningSanity`: valid movement/boost defaults.
- `DropfallArena.ProductIntegrity.MonetizationPolicy`: active-match and paid
  entitlement ad restrictions.
- `DropfallArena.Ladder.ProgressionAndRetries`: Rookie → Rival → Ace, failure,
  retry, inactive/results timer exclusion and duplicate transition rejection.
- `DropfallArena.Ladder.RankingAndSaveCompatibility`: partial/failed runs excluded,
  conceded-round/time ordering, top-five cap, old win counts preserved and
  SaveGame memory serialization roundtrip.

Automation does not write test scores to the user's on-disk progress slot.
Log: `/tmp/dropfall-arena-phase17-final-tests.log`.

## Builds

- Editor Mac Development: succeeded using installed Unreal 5.8.1.
- Game Mac Development: succeeded; this is compilation/local signing, not a
  cooked, packaged or storefront-ready distribution.

## Runtime checks

- Setup and results fit the 640px preview and expanded viewports without overlap.
- Keyboard selects Practice/Ladder/Couch; Q changes practice tier and preserves
  existing per-tier records. Enter starts a countdown and gameplay.
- Unreal Slate Inspector mouse click reached the controller/HUD and changed
  Practice Rookie to Rival. Desktop-level click automation did not reliably
  deliver events in the multi-display Mac setup; do not claim that path passed.
- Couch ring-outs were triggered by moving the transient PIE Cyan actor below
  the floor. Scores progressed to 0–3, CORAL WINS appeared, and Enter rematch
  restarted at 0–0 with a countdown. No save-slot writes from these couch tests.
- The rebuilt arena visibly has separated bumpers, the intended blue floor,
  and cyan/coral perimeter accents. Before this fix, new mesh roots ignored
  the actors' intended spawn positions and the default cube material ignored
  colour parameters.
- Final preview is open on Solo Ladder setup, enlarged and idle until Start.
- No runtime fatal/ensure errors were found in the final editor log. The MCP
  client logged one stale-session reconnect error after the editor restart.

## Remaining hands-on coverage

- Two physical controllers have not been exercised.
- Native mouse clicks across every card/button and display need hands-on coverage.
- Full ladder state/persistence is contract-tested; a complete three-opponent
  hands-on run remains a playtest task.
- Leaderboard is local to this device, not authenticated or online.
- Final art, settings/accessibility and distribution packaging remain deferred.
