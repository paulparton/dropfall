# Dropfall Game Server

A WebSocket-based game server for Dropfall online multiplayer.

## Quick Start

```bash
# Install dependencies
npm install

# Build the game and start the LAN server
npm run start
```

The server listens on every IPv4 network interface and uses port 3000 by
default. You can change the port:

```bash
PORT=8080 npm run start
```

## Accessing the Server

- **This computer**: `http://localhost:3000`
- **Local hostname**: `http://your-computer.local:3000`
- **Local IP**: for example, `http://192.168.1.100:3000`

The startup output prints the exact hostname and IP URLs available on the
current computer.

## Network Setup

For other players to connect:

1. Connect the phone or tablet to the same Wi-Fi network as the server.
2. Run `npm run start` on the server computer.
3. Open the printed `.local` or IP URL in the mobile browser.
4. If macOS asks whether Node may accept incoming connections, choose **Allow**.

Dropfall uses the page's hostname for its level API and multiplayer WebSocket,
so a game opened at `http://your-computer.local:3000` stays on that hostname
instead of trying to connect to `localhost` on the mobile device.

Optional binding overrides:

```bash
DROPFALL_HOST=0.0.0.0 \
DROPFALL_LOCAL_HOSTNAME=skippy.local \
DROPFALL_ALLOWED_ORIGINS=http://skippy.local:3000 \
npm run start
```

### Internet deployment

Do not expose the development server by directly forwarding the port. Internet
deployments require TLS termination, an exact `DROPFALL_ALLOWED_ORIGINS`
allowlist, managed secrets, rate and connection controls at the edge, monitoring,
and the release authentication/data services described in the release refresh
specification.

## Features

- **Quake-style matchmaking**: Create and join game lobbies
- **Real-time game sync**: WebSocket-based player position and state sync
- **Loopback operator panel**: View local development status and create test games
- **Multi-game support**: Architecture supports adding more games

## API

### WebSocket Protocol

Connect via `ws://server:port/` on trusted local networks or `wss://` in hosted
environments. Browser origins must be same-origin or included in
`DROPFALL_ALLOWED_ORIGINS`.

**Client → Server Messages:**

| Type | Description |
|------|-------------|
| `set_name` | Set player display name |
| `list_games` | Request available games |
| `create_game` | Create a new game lobby |
| `join_game` | Join an existing game |
| `leave_game` | Leave current game |
| `start_game` | Start game (host only) |
| `player_input` | Send input state |
| `game_state` | Send game state (host only) |
| `round_over` | Signal round end |

**Server → Client Messages:**

| Type | Description |
|------|-------------|
| `connected` | Connection confirmed with player ID |
| `game_list` | List of available games |
| `game_created` | Game created confirmation |
| `game_joined` | Joined game confirmation |
| `player_joined` | Another player joined |
| `player_left` | A player left |
| `game_starting` | Countdown to game start |
| `game_started` | Game has started |
| `opponent_input` | Opponent's input state |
| `game_state_update` | Full game state (host broadcast) |
| `error` | Error message |

## Architecture

```
server/
├── server.js      # Main server (HTTP + WebSocket)
└── public/
    └── index.html # Admin web interface
```

The server uses:
- Native `http` module for the admin web interface
- `ws` library for WebSocket connections
- In-memory storage for games and players (no database required)

## Security baseline

- WebSocket messages are schema-validated, size-limited, rate-limited, and
  protected by an origin allowlist and heartbeat.
- Match reconnects require a rotating random token. A client cannot claim an
  arbitrary disconnected slot.
- The legacy admin/editor pages are loopback-only unless
  `DROPFALL_ENABLE_DEV_TOOLS=1` is deliberately set.
- Level reads, creation, and updates are temporarily public. Level deletion requires
  `DROPFALL_EDITOR_TOKEN` as a bearer token and is disabled when it is absent.
- Published battle arenas remain selectable even when they contain disconnected,
  decorative, or otherwise unreachable tiles; validation data is advisory only.
- Set `DROPFALL_ALLOWED_ORIGINS` to a comma-separated list of exact production
  origins. Wildcard CORS is not supported.
- Use WSS/HTTPS at the production ingress. The Node process intentionally leaves
  TLS termination to the hosting platform or reverse proxy.
- This is the release-foundation boundary, not the final account service.
  Ranked play, UGC publishing, profiles, entitlements, and moderation still
  require the durable authenticated backend specified in
  `DROPFALL_RELEASE_REFRESH_SPEC.md`.
