# Dropfall Game Server

A WebSocket-based game server for Dropfall online multiplayer.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm run server
```

The server will start on port 3000 by default. You can change the port:

```bash
PORT=8080 npm run server
```

## Accessing the Server

- **Admin Panel**: `http://localhost:3000` - Configure games, view stats
- **Game Clients**: Connect from the game using the server's IP address

## Network Setup

For other players to connect:

1. Find the server computer's local IP address (e.g., `192.168.1.100`)
2. Players enter this IP in the game's online multiplayer menu: `192.168.1.100:3000`

### Port Forwarding (for internet play)

If you want players outside your network to connect:

1. Forward port 3000 (or your custom port) on your router
2. Use your public IP address instead of local IP

## Features

- **Quake-style matchmaking**: Create and join game lobbies
- **Real-time game sync**: WebSocket-based player position and state sync
- **Admin panel**: View connected players, create test games, configure settings
- **Multi-game support**: Architecture supports adding more games

## API

### WebSocket Protocol

Connect via `ws://server:port/`

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

## Security Notes

- This is designed for local network play
- No authentication by default
- No encryption (use WSS for internet play)
- For production deployment, add authentication and rate limiting
