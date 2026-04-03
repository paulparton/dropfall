# Getting Started with Level Editor Server

## 🎯 Quick Start (< 2 minutes)

### Step 1: Start the Editor
```bash
npm run editor:dev
```

### Step 2: Open in Browser
Visit: **http://localhost:3001**

### Step 3: Create Your First Level
1. Select "Hexagon" template from left sidebar
2. Click Paint tool (🎨)
3. Click some tiles to paint them
4. Click Playtest button to test it

### Step 4: Save
Click "💾 Save" button → Downloaded as JSON file

**Done!** You've created your first level! 🎉

---

## 📚 Next Steps

### Want to Use Everything Together?
```bash
npm run dev:full
```
- Game: http://localhost:3000
- Editor: http://localhost:3000/editor

### Want to Learn More?
- Read: `LEVEL_EDITOR_SERVERS_QUICK_REFERENCE.md`
- Read: `LEVEL_EDITOR_SERVER.md` (full API docs)
- Read: `LEVEL_EDITOR_QUICK_START.md` (user guide)

### Want to Deploy?
- Run: `npm run integrated:dev` for development
- Use `integrated-server.js` for production

---

## 🚀 Available Commands

### Editor Only
```bash
npm run editor              # Start at port 3001
npm run editor:dev          # With auto-reload
```

### Game Only  
```bash
npm run game                # Start at port 3000
npm run game:dev            # With auto-reload
```

### Everything Together (Recommended)
```bash
npm run dev:full            # Both at port 3000
npm run integrated:dev      # Same as above
```

---

## 🎮 Three Ways to Use

### Way 1: Pure Level Designer
```bash
npm run editor:dev
# Just design levels
# http://localhost:3001
```

### Way 2: Design + Test Side-by-Side
```bash
# Terminal 1
npm run editor:dev

# Terminal 2  
npm run game:dev

# Switch between ports 3001 and 3000
```

### Way 3: All-in-One (Best for Production)
```bash
npm run dev:full
# http://localhost:3000 (game)
# http://localhost:3000/editor (editor)
```

---

## 📁 Levels Are Saved To

```
server/levels/
  ├── level_1704067200000.json
  ├── level_1704067300000.json
  └── ...
```

Each level is automatically saved as a JSON file.

---

## 🔄 Workflow

1. **Design** - Create levels with editor
2. **Save** - Automatically saved to disk
3. **Playtest** - Click Playtest button in editor
4. **Test in Game** - Load level in game (via API)
5. **Iterate** - Make changes and repeat

---

## 📡 API Examples

### List All Levels
```bash
curl http://localhost:3001/api/levels | jq
```

### Get Specific Level
```bash
curl http://localhost:3001/api/levels/level_1704067200000 | jq
```

### Download Level as JSON
```bash
curl http://localhost:3001/api/export/level_1704067200000 > my_level.json
```

---

## ⚙️ Custom Ports

```bash
# Run editor on port 8080
EDITOR_PORT=8080 npm run editor:dev

# Run game on port 8000
PORT=8000 npm run game:dev

# Run both with custom ports
EDITOR_PORT=8001 PORT=8000 npm run integrated:dev
```

---

## 🆘 Troubleshooting

**Port already in use?**
```bash
EDITOR_PORT=3002 npm run editor:dev
```

**Can't see `/editor` route?**
Make sure you're running: `npm run integrated` or `npm run dev:full`
(NOT `npm run game`)

**Levels not showing?**
Check that `server/levels/` directory exists:
```bash
ls -la server/levels/
```

---

## 📖 Full Documentation

- **Quick Reference** → `LEVEL_EDITOR_SERVERS_QUICK_REFERENCE.md`
- **Full API Docs** → `LEVEL_EDITOR_SERVER.md`  
- **User Guide** → `LEVEL_EDITOR_QUICK_START.md`
- **Architecture** → `LEVEL_EDITOR_ARCHITECTURE.md`
- **Editor Itself** → `LEVEL_EDITOR_START_HERE.md`

---

## 🎯 Files You Need to Know

### Server Files
- `server/editor-server.js` - Editor server code
- `server/integrated-server.js` - Game + editor together
- `server/server.js` - Original game server (unchanged)

### Documentation
- `LEVEL_EDITOR_SERVER.md` - API reference
- `LEVEL_EDITOR_SERVERS_QUICK_REFERENCE.md` - Quick guide
- `package.json` - npm scripts (updated with 8 new commands)

### Level Storage
- `server/levels/` - Where levels are saved

---

## ✅ Verification Checklist

- [ ] Run `npm run editor:dev`
- [ ] Visit http://localhost:3001
- [ ] Create a level
- [ ] Click Save
- [ ] Check `server/levels/` for JSON file
- [ ] Run `curl http://localhost:3001/api/levels`
- [ ] See your level in the list

---

## 🎉 You're Ready!

Run this to get started:

```bash
npm run editor:dev
```

Then open: **http://localhost:3001**

Happy level designing! 🎨

---

For questions, see the documentation files or check `LEVEL_EDITOR_SERVER.md` for complete API reference.
