# 🎨 Dropfall 3D Level Editor

## What You Have Now

A **real 3D hex level editor** that matches your game exactly:

- ✅ **3D visualization** using Three.js (same as game)
- ✅ **Hex tiles** (cylinder geometry with 6 sides)
- ✅ **Axial coordinates** (q, r system) just like the game
- ✅ **Same tile types**: NORMAL, ICE, PORTAL, BONUS, WARNING
- ✅ **Same materials** and colors as the game
- ✅ **Interactive 3D camera** - rotate, zoom, pan
- ✅ **Real-time visualization** - see tiles as you place them

## Quick Start

```bash
npm run editor:dev
```

Then open: **http://localhost:3001**

## How It Works

### Controls
- **Left Mouse Drag** - Rotate camera around scene
- **Scroll Wheel** - Zoom in/out
- **Right Click** - Place/remove tiles
- **Left Click** - Select/inspect tiles

### Workflow
1. Enter level name and description (right panel)
2. Choose tile type from buttons (NORMAL, ICE, PORTAL, etc.)
3. Right-click on the 3D grid to place tiles
4. Left-click tiles to inspect coordinates
5. **SAVE** button stores level to `server/levels/`
6. **EXPORT** button downloads as JSON

### What You See
- **3D viewport**: Real-time visualization of hex tiles
- **Right panel**: Level controls, tile type selector, level browser
- **Canvas**: Black background with grid, tiles rendered in 3D
- **Same materials** as the game - emissive PORTAL tiles, glowing BONUS tiles, etc.

## Level Storage

Saved to: `server/levels/`

Each level is a JSON file containing:
```json
{
  "name": "My Arena",
  "description": "A test level",
  "difficulty": "normal",
  "theme": "default",
  "tiles": [
    { "coord": { "q": 0, "r": 0 }, "ability": "NORMAL", "height": 4 },
    { "coord": { "q": 1, "r": 0 }, "ability": "ICE", "height": 4 },
    { "coord": { "q": 0, "r": 1 }, "ability": "PORTAL", "height": 4 }
  ]
}
```

## Tile Types

| Type | Color | Effect |
|------|-------|--------|
| NORMAL | Gray | Regular playable tile |
| ICE | Cyan | Slippery surface |
| PORTAL | Cyan + Emissive | Teleport point |
| BONUS | Yellow + Emissive | Bonus points |
| WARNING | Orange | Hazard/falling |

## REST API

While the editor runs, you can use the API:

```bash
# List all levels
curl http://localhost:3001/api/levels

# Get specific level
curl http://localhost:3001/api/levels/level_123456

# Create level
curl -X POST http://localhost:3001/api/levels \
  -H "Content-Type: application/json" \
  -d '{ "name": "Test", "tiles": [], ... }'

# Update level
curl -X PUT http://localhost:3001/api/levels/level_123456 \
  -H "Content-Type: application/json" \
  -d '{ ... updated level ... }'

# Delete level
curl -X DELETE http://localhost:3001/api/levels/level_123456
```

## Next Steps

1. **Build levels** in the 3D editor
2. **Test playability** - levels are saved to disk
3. **Integrate with game** - modify game to load and play these levels

## Files

- `server/editor-3d-server.js` - HTTP server + REST API
- `server/public/editor-3d.html` - 3D editor UI (Three.js)
- `server/levels/` - Level storage directory
- `package.json` - Added npm scripts

## Game Integration (Later)

To make the game use custom levels:
1. Load levels from `server/levels/`
2. Display level selection menu
3. Spawn arena with selected level tiles

---

**Status**: ✅ 3D Level Editor running on http://localhost:3001
