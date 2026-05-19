# Level Editor Server - Entry Points

## Overview

The level editor can run in three modes:

1. **Standalone** - Level editor only (port 3001)
2. **Integrated** - Both game and editor on same server (port 3000)
3. **In-Game** - Editor accessible from `/editor` route

## Quick Start

### Run Level Editor Only
```bash
npm run editor          # Starts at http://localhost:3001
npm run editor:dev      # With auto-restart on file changes
```

### Run Game + Editor Together
```bash
npm run integrated      # Both at http://localhost:3000
npm run integrated:dev  # With auto-restart
npm run dev:full       # Alias for integrated:dev
```

### Run Game Only
```bash
npm run game           # Game at http://localhost:3000
npm run game:dev       # With auto-restart
npm run server         # Alias for game
npm run server:dev     # Alias for game:dev
```

## Server Files

### `editor-server.js`
- Standalone level editor server
- Includes REST API for level management
- Can be embedded in other servers
- **Port:** 3001 (standalone)
- **Routes:**
  - `GET  /` - Editor HTML
  - `GET  /api/levels` - List all levels
  - `GET  /api/levels/:id` - Get level
  - `POST /api/levels` - Save level
  - `PUT  /api/levels/:id` - Update level
  - `DELETE /api/levels/:id` - Delete level
  - `GET  /api/export/:id` - Download level as JSON
  - `GET  /api/stats` - Server statistics

### `integrated-server.js`
- Combines game server with level editor
- Routes `/editor/*` to editor
- Routes everything else to game
- **Port:** 3000
- **Editor URL:** `http://localhost:3000/editor`
- **Game URL:** `http://localhost:3000`

## API Reference

### List All Levels
```bash
curl http://localhost:3001/api/levels
```

**Response:**
```json
[
  {
    "id": "level_1704067200000",
    "name": "My Arena",
    "description": "A balanced 1v1 arena",
    "createdAt": 1704067200000,
    "lastModified": 1704067200000,
    "author": "Player",
    "difficulty": "normal",
    "tileCount": 42
  }
]
```

### Get Specific Level
```bash
curl http://localhost:3001/api/levels/level_1704067200000
```

**Response:** Full level data with all tiles

### Save Level
```bash
curl -X POST http://localhost:3001/api/levels \
  -H "Content-Type: application/json" \
  -d @level.json
```

**Request Body:**
```json
{
  "name": "My Arena",
  "description": "Test level",
  "tiles": [...],
  "theme": "tron",
  "difficulty": "normal"
}
```

**Response:**
```json
{
  "id": "level_1704067200000",
  "success": true
}
```

### Update Level
```bash
curl -X PUT http://localhost:3001/api/levels/level_1704067200000 \
  -H "Content-Type: application/json" \
  -d @level.json
```

### Delete Level
```bash
curl -X DELETE http://localhost:3001/api/levels/level_1704067200000
```

### Export Level as JSON File
```bash
curl http://localhost:3001/api/export/level_1704067200000 > level.json
```

### Get Server Statistics
```bash
curl http://localhost:3001/api/stats
```

**Response:**
```json
{
  "uptime": 123456,
  "totalRequests": 42,
  "levelsSaved": 5,
  "levelsLoaded": 12,
  "levelsInMemory": 3
}
```

## Level Storage

Levels are stored in `server/levels/` directory as JSON files:
- Each level: `server/levels/{levelId}.json`
- Auto-loaded on server startup
- Auto-saved when modified via API

## Integration with Game

### Option 1: Separate Servers
```bash
# Terminal 1: Game server
npm run game:dev

# Terminal 2: Editor server
npm run editor:dev

# Access:
# Game: http://localhost:3000
# Editor: http://localhost:3001
```

### Option 2: Single Server
```bash
# Terminal: Both game and editor
npm run dev:full

# Access:
# Game: http://localhost:3000
# Editor: http://localhost:3000/editor
```

### Option 3: From Game Menu
```typescript
// In game code
import { setupEditorMenuItem } from './editor/integration'

setupEditorMenuItem()  // Adds editor button to menu
// Click to open editor at /editor or 3001
```

## Environment Variables

```bash
# Editor server port (standalone mode)
EDITOR_PORT=3001

# Game server port
PORT=3000

# Example
EDITOR_PORT=8080 npm run editor
PORT=8000 npm run game
```

## Architecture

### Standalone Mode
```
┌─────────────────────────────────┐
│   Level Editor Server (3001)    │
│                                 │
│  editor-server.js               │
│  ├─ HTTP Server                 │
│  ├─ REST API                    │
│  └─ Level Storage               │
└─────────────────────────────────┘
```

### Integrated Mode
```
┌──────────────────────────────────────────┐
│   Combined Server (3000)                 │
│                                          │
│  ┌──────────────────┐                    │
│  │  Game Routes     │                    │
│  │  (/ /api/games)  │                    │
│  └──────────────────┘                    │
│                                          │
│  ┌──────────────────┐                    │
│  │  Editor Routes   │                    │
│  │  (/editor /api)  │                    │
│  └──────────────────┘                    │
│                                          │
│  integrated-server.js                    │
└──────────────────────────────────────────┘
```

## File Structure

```
server/
├── server.js              # Original game server
├── editor-server.js       # NEW: Standalone editor
├── integrated-server.js   # NEW: Combined game + editor
├── levels/                # NEW: Level storage directory
│   ├── level_1.json
│   ├── level_2.json
│   └── ...
├── public/                # Game static files
│   ├── index.html
│   └── ...
└── README.md
```

## Development Workflow

### Design Levels
```bash
npm run editor:dev
# http://localhost:3001
# Edit, save, playtest
```

### Test in Game
```bash
# In another terminal
npm run game:dev
# http://localhost:3000

# Upload level from editor and test in game
```

### Deploy with Game
```bash
npm run integrated:dev
# Both at http://localhost:3000
# Editor at /editor route
```

## API Examples

### JavaScript/Fetch
```javascript
// List levels
const levels = await fetch('http://localhost:3001/api/levels')
  .then(r => r.json())

// Save level
const response = await fetch('http://localhost:3001/api/levels', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(myLevel)
})
const { id } = await response.json()

// Load level
const level = await fetch(`http://localhost:3001/api/levels/${id}`)
  .then(r => r.json())

// Delete level
await fetch(`http://localhost:3001/api/levels/${id}`, {
  method: 'DELETE'
})
```

### cURL
```bash
# List
curl http://localhost:3001/api/levels | jq

# Save
curl -X POST http://localhost:3001/api/levels \
  -H "Content-Type: application/json" \
  -d @level.json | jq

# Export
curl http://localhost:3001/api/export/level_id > my_level.json
```

## Troubleshooting

### Port Already in Use
```bash
# Change port
EDITOR_PORT=3002 npm run editor
PORT=8000 npm run game
```

### Levels Not Saving
- Check `server/levels/` directory permissions
- Ensure directory exists
- Check server console for errors

### Can't Access /editor Route
- Make sure running `integrated-server.js` or `integrated:dev`
- Check that port 3000 is listening
- Browser cache might need clearing

### CORS Issues
- All API routes return CORS headers
- Should work from any origin

## Next Steps

1. **Run Editor:** `npm run editor:dev`
2. **Create Level:** Select template, paint tiles
3. **Playtest:** Click Playtest button
4. **Save:** Automatically saved to server
5. **Share:** Download JSON or share via API

---

For more information, see:
- `LEVEL_EDITOR_START_HERE.md` - Getting started guide
- `LEVEL_EDITOR_QUICK_START.md` - User tutorials
- `src/editor/README.md` - API reference
