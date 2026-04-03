# Level Editor Servers - Quick Reference

## 🚀 Start Servers

### Standalone Editor Only (Port 3001)
```bash
npm run editor          # Start
npm run editor:dev      # Start with auto-reload
```
📍 **URL:** http://localhost:3001

### Game Only (Port 3000)
```bash
npm run game            # Start
npm run game:dev        # Start with auto-reload
```
📍 **URL:** http://localhost:3000

### Game + Editor Together (Port 3000)
```bash
npm run integrated      # Start
npm run integrated:dev  # Start with auto-reload
npm run dev:full       # Alias
```
📍 **URLs:**
- Game: http://localhost:3000
- Editor: http://localhost:3000/editor

---

## 📁 Server Files

| File | Purpose | Mode | Port |
|------|---------|------|------|
| `server/server.js` | Original game server | Standalone | 3000 |
| `server/editor-server.js` | Level editor server | Standalone | 3001 |
| `server/integrated-server.js` | Game + Editor | Integrated | 3000 |

---

## 🎯 Common Workflows

### Workflow 1: Just Design Levels
```bash
npm run editor:dev
# http://localhost:3001
# Create/edit/save levels only
```

### Workflow 2: Design + Test in Game
```bash
# Terminal 1
npm run editor:dev
# Terminal 2
npm run game:dev

# Switch between http://localhost:3001 and http://localhost:3000
```

### Workflow 3: Everything in One Window
```bash
npm run dev:full
# http://localhost:3000 (game)
# http://localhost:3000/editor (editor)
```

---

## 📡 API Endpoints

### When Running Standalone (port 3001)
```
GET    /                              → Editor HTML
GET    /api/levels                    → List levels
GET    /api/levels/:id                → Get level
POST   /api/levels                    → Save level
PUT    /api/levels/:id                → Update level
DELETE /api/levels/:id                → Delete level
GET    /api/export/:id                → Download as JSON
GET    /api/stats                     → Server stats
```

### When Running Integrated (port 3000)
```
GET    /                              → Game
GET    /editor                        → Editor HTML
GET    /editor/api/levels             → List levels
GET    /editor/api/levels/:id         → Get level
POST   /editor/api/levels             → Save level
PUT    /editor/api/levels/:id         → Update level
DELETE /editor/api/levels/:id         → Delete level
GET    /editor/api/export/:id         → Download as JSON
GET    /editor/api/stats              → Server stats
```

---

## 💾 Level Storage

All levels stored in: `server/levels/`

Each level is a JSON file:
- Filename: `{levelId}.json`
- Auto-loaded on startup
- Auto-saved via API

Example:
```bash
ls server/levels/
# level_1704067200000.json
# level_1704067300000.json
```

---

## 📊 Quick Examples

### Save a Level
```bash
curl -X POST http://localhost:3001/api/levels \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Arena",
    "description": "Test level",
    "tiles": [],
    "theme": "tron",
    "difficulty": "normal"
  }'
```

### Get All Levels
```bash
curl http://localhost:3001/api/levels | jq
```

### Export Level as File
```bash
curl http://localhost:3001/api/export/level_1704067200000 > my_level.json
```

### Delete a Level
```bash
curl -X DELETE http://localhost:3001/api/levels/level_1704067200000
```

---

## 🔧 Environment Variables

```bash
# Editor port (standalone mode)
export EDITOR_PORT=3001

# Game port
export PORT=3000

# Run with custom port
EDITOR_PORT=8080 npm run editor
PORT=8000 npm run game
```

---

## 📝 Level Format

```json
{
  "id": "level_1704067200000",
  "name": "My Arena",
  "description": "A balanced 1v1 arena",
  "createdAt": 1704067200000,
  "lastModified": 1704067200000,
  "version": 1,
  "tiles": [
    {
      "coord": {"q": 0, "r": 0, "y": 0},
      "ability": "NORMAL",
      "height": 0,
      "isVisible": true
    }
  ],
  "groups": [],
  "theme": "tron",
  "difficulty": "normal",
  "tags": [],
  "destructionRate": 3.0,
  "iceRate": 2.0,
  "portalRate": 8.0,
  "bonusRate": 6.0,
  "symmetry": "none",
  "boundaryType": "invisible",
  "isPublic": false,
  "author": "Player"
}
```

---

## ✅ Checklist

- [ ] Run editor: `npm run editor:dev`
- [ ] Create a level
- [ ] Save it
- [ ] See it in `server/levels/`
- [ ] List via API: `curl http://localhost:3001/api/levels`
- [ ] Export as JSON: `curl http://localhost:3001/api/export/{id}`
- [ ] Test playtest button in editor

---

## 🎮 From Game Menu

To add editor button to game menu:

```typescript
// In game initialization
import { setupEditorMenuItem } from './editor/integration'

setupEditorMenuItem()  // Adds "Level Editor" button
```

Clicking button opens editor at current `/editor` path.

---

## 📚 More Information

- **Getting Started:** LEVEL_EDITOR_START_HERE.md
- **User Guide:** LEVEL_EDITOR_QUICK_START.md
- **Full Docs:** LEVEL_EDITOR_SERVER.md
- **Architecture:** LEVEL_EDITOR_ARCHITECTURE.md
- **API Details:** src/editor/README.md

---

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 in use | `PORT=8000 npm run game` |
| Port 3001 in use | `EDITOR_PORT=8001 npm run editor` |
| Levels not showing | Check `server/levels/` exists |
| Can't access /editor | Run `npm run integrated` not `npm run game` |
| CORS errors | All endpoints include CORS headers |

---

**Quick Links:**
- Editor Standalone: `npm run editor:dev`
- Both Together: `npm run dev:full`
- Game Only: `npm run game:dev`

