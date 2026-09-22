# Dropfall Arena — Unreal

This directory contains the Unreal Engine 5.8 implementation of Dropfall Arena.
The existing Three.js game remains Dropfall Classic: the free web edition and
playable design reference.

## First playable greybox

The editor boots directly into a runtime-generated arena with no content
dependencies. Play-in-Editor defaults to local versus AI.

- Player 1: `WASD`, `Space` to boost
- Player 1 gamepad: left stick, bottom face button to boost
- Player 2: arrow keys, `Right Shift` to boost
- Player 2 gamepad: second controller left stick, bottom face button to boost
- `Tab`: switch between versus AI and couch versus
- `Q`: cycle Rookie, Rival, and Ace AI
- `R`: reset the match
- First fighter to three ring-outs wins

Movement is screen-relative: `W` always moves toward the top of the shared
camera, regardless of Unreal world axes. Press Enter, Space, or the bottom
gamepad face button at the ready screen to start the countdown. After 30
seconds the platform enters Sudden Drop and begins shrinking.

The boost bars at the bottom of the screen refill toward ready. AI tiers change
reaction time, prediction, aggression, and edge recovery without changing the
fighter's mass, acceleration, speed cap, or boost physics.

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
