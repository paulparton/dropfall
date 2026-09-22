# Dropfall Arena — Unreal

This directory contains the Unreal Engine 5.8 implementation of Dropfall Arena.
The existing Three.js game remains Dropfall Classic: the free web edition and
playable design reference. All Classic development is currently deferred; active
work is scoped to Arena.

## First playable greybox

The editor boots into a runtime-generated arena using the original meshes and
materials in `Content/Arena`. Play-in-Editor opens setup with Solo Ladder selected.

- Player 1: `WASD`, `Space` to boost
- Player 1 gamepad: left stick, bottom face button to boost
- Player 2: arrow keys, `Right Shift` to boost
- Player 2 gamepad: second controller left stick, bottom face button to boost
- Left/Right, D-pad, `Tab`, or click: choose Practice / Solo Ladder / Couch
- `Q` or gamepad Y: cycle AI difficulty in Practice setup
- `E` or right shoulder: cycle Foundry / Crosswind / Skyway in setup
- `F` or left shoulder: choose Fall Away / Stable Arena in setup
- Enter/Space/gamepad A: start, advance from results, or replay
- `R`: restart match (restarts the entire run in Solo Ladder)
- `M` or gamepad Start: return to setup and abandon current run
- First fighter to three ring-outs wins

Movement is screen-relative: `W` always moves toward the top of the shared
camera, regardless of Unreal world axes. Press Enter, Space, or the bottom
gamepad face button at the ready screen to start the countdown. Fall Away marks
outer extensions red for four seconds before they drop at 30 seconds, then
removes the intermediate galleries at 50 seconds. The final 16 x 16m arena,
its terrace, two connecting ramps and two launch pads never fall. Stable Arena
never removes terrain.

Foundry is a 24 x 24m industrial forge with six ramps; Crosswind is a 32 x 24m
skyport with eight; Skyway is a 32 x 32m neon orbital arena with ten. All have
multiple elevations, flush connecting ramps, free-flight slopes and automatic
launch pads. Pad arrows indicate launch direction; a 1.4-second per-fighter
lockout prevents stacked launches. Higher decks reach 4.2m on Skyway.
Forge, Turbine and Orbit sphere shells change with the map while retaining
cyan/coral player markings and identical spherical physics. Editable Blender
sources and reproducible import scripts are in `ArtSource`.

The boost bars at the bottom of the screen refill toward ready. AI tiers change
reaction time, prediction, aggression, and edge recovery without changing the
fighter's mass, acceleration, speed cap, or boost physics. Solo Ladder progresses
through Rookie, Rival and Ace. Only completed runs enter the saved local top five,
ordered by fewest conceded rounds and then fastest active play time, separately
for each map/terrain rule. Map/rule choices are fixed during a run. Legacy
prototype scores remain in the save but do not compete against new-map scores.

Click the PIE viewport once if keyboard focus is not already captured.

## Product boundary

- **Arena** is the primary party and competitive product for Steam and future
  native storefronts. A paid entitlement disables advertising permanently.
- **Classic** remains a deliberately smaller free web game. Advertising is
  restricted to menus and between sessions, never active rounds.
- Gameplay behavior is reimplemented from measured design contracts. JavaScript
  runtime code is not ported line-for-line into Unreal.

## Engine contract

- Unreal Engine 5.8.1
- C++ for gameplay rules, movement, network prediction, AI contracts, match
  authority, replay validation, and ranked integrity
- Blueprints and data assets for presentation, composition, content, and tuning
- Dedicated authoritative servers for ranked play
- In-game creator tools built on validated modular arena pieces

## Local validation

Build the editor target:

```sh
'/Users/Shared/Epic Games/UE_5.8/Engine/Build/BatchFiles/Mac/Build.sh' \
  DropfallArenaEditor Mac Development \
  "$PWD/unreal/DropfallArena.uproject" \
  -NoHotReloadFromIDE
```

Launch the editor with its MCP server available only on loopback:

```sh
open -n -a '/Users/Shared/Epic Games/UE_5.8/Engine/Binaries/Mac/UnrealEditor.app' \
  --args "$PWD/unreal/DropfallArena.uproject" \
  -ModelContextProtocolStartServer \
  -ModelContextProtocolPort=8000
```

The Epic Launcher engine distribution cannot compile `TargetType.Server`.
Production dedicated-server builds require a UE 5.8 source build or CI runner
configured with one. The server target remains in source so this requirement is
enforced from the beginning.

## MCP

Project-scoped Codex configuration lives at `../.codex/config.toml`. The Unreal
MCP endpoint is unauthenticated and must remain bound to `127.0.0.1`.
