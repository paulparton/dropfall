# Level Editor Quick Start Guide

## Getting Started

### 1. Open the Editor

```typescript
import { launchLevelEditor } from './editor/LevelEditor'

// In your main UI/menu
const editorContainer = document.getElementById('editor')
const editor = launchLevelEditor(editorContainer)
```

### 2. Create Your First Level (5 Minutes)

**Step-by-step:**

1. Click **"📄 New"** to start fresh
2. In the left sidebar (**Library**), click a template:
   - Start with **"Hexagon"** (basic, good for learning)
3. The arena appears! ✓
4. Select the **"Paint"** tool (🎨)
5. In the right sidebar (**Inspector**):
   - Change "Tile Ability" to "BONUS"
   - Brush Radius: 2
6. Click on a few tiles to paint them yellow
7. Click **"Playtest"** to play your level!

### 3. Common Tasks

#### Add Special Tiles

```
1. Select Paint tool
2. Choose ability in Inspector:
   - NORMAL: Standard tile
   - ICE: Slippery
   - PORTAL: Teleport
   - BONUS: Extra points
   - HAZARD: Dangerous
3. Click and drag on tiles to paint
```

#### Create a Gap

```
1. Select Erase tool
2. Set Brush Radius to 2-3
3. Click center of gap you want
4. Tiles disappear = gap created
```

#### Make It Fair (1v1)

```
1. Select some tiles
2. Click Symmetry tool
3. Choose "Radial 6x" from Inspector
4. Level now has perfect balance!
```

#### Add Height Variation

```
1. Select Height tool
2. Move "Height" slider to 2 or 3
3. Click tiles to raise them
4. Creates ramps and platforms
```

#### Save Your Level

```
1. Make sure level looks good
2. Click "💾 Save"
3. Download as .json file
4. Can load it back anytime!
```

#### Load a Saved Level

```
1. Click "📂 Load"
2. Select .json file
3. Level loads into editor
4. Continue editing!
```

## Toolbar Reference

| Button | Name | What It Does |
|--------|------|-------------|
| ◆ | SELECT | Click to select tiles |
| ↔ | MOVE | Drag tiles to new spots |
| 🎨 | PAINT | Paint new tiles |
| ✕ | ERASE | Delete tiles |
| ⬆ | HEIGHT | Make tiles higher/lower |
| ❌ | HAZARD BRUSH | Random danger zones |
| ⚖ | SYMMETRY | Mirror for fairness |
| ⬜ | BOUNDARY | Add safety walls |

## Inspector Controls

### Left Column: Painting
- **Brush Radius**: How many tiles to affect (1-10)
- **Tile Ability**: What type of tile to place
- **Height**: How high/low the tile is

### Middle Column: Symmetry
- **Symmetry Mode**: Mirror pattern (None / Bilateral / Radial 3x / Radial 6x)

### Right Column: Stats
- **Tiles**: Total tiles in level
- **Groups**: Grouped tile collections
- **Selection**: Currently selected tiles
- **Validation**: Any errors/warnings

## Template Library

### Quick Levels (< 1 minute)

| Template | Size | Style | Good For |
|----------|------|-------|----------|
| Hexagon | r=5 | Classic | Learning |
| Ring | r=6 | Donut | Chasing |
| Cross | r=5 | 4-way | Multiple paths |
| Diamond | r=5 | Compact | Tight gameplay |

### Complex Levels (5-10 minutes)

| Template | Size | Style | Good For |
|----------|------|-------|----------|
| Island | r=6 | Separated | Strategic play |
| Spiral | r=5 | Winding | Flow challenges |
| Obstacle Course | r=6 | Parkour | Skill tests |

### Competitive (10-15 minutes)

| Template | Size | Style | Good For |
|----------|------|-------|----------|
| Duel | r=4 | Perfect symmetry | 1v1 balance |
| King of Hill | r=6 | Raised center | Control points |
| Corners | r=7 | Safe edges | Territory battle |

## Keyboard Shortcuts

```
Ctrl+Z              Undo last action
Ctrl+Y              Redo (undo the undo)
Delete              Remove selected tiles
Right Click + Drag  Pan camera around
Scroll Wheel        Zoom in/out
```

## Common Issues & Solutions

### "Level has errors" - Can't Playtest

**Problem:** Red warnings in Inspector validation panel

**Solution:**
- Add more tiles (need at least 5)
- Reduce red hazard tiles (keep < 50%)
- Make sure level isn't disconnected
- Add boundary walls

### Tiles Not Moving

**Problem:** Clicked move tool but can't drag

**Solution:**
1. Click SELECT tool first
2. Click tiles to select them (yellow highlight)
3. Then click MOVE tool
4. Now drag selected tiles

### Zoomed Too Far In/Out

**Problem:** Can't see the level

**Solution:**
- Scroll wheel to zoom in/out
- Or double-click on canvas to reset view
- Right-click + drag to pan around

### Want to Start Over

**Problem:** Messed up the level

**Solution:**
1. Click "📄 New"
2. Confirm deletion
3. Start fresh!

## Tips & Tricks

### Speed Up Workflow

1. **Use Templates** - Don't build from scratch, modify templates
2. **Symmetry Early** - Apply symmetry before adding details
3. **Playtest Often** - Test every few changes to catch issues
4. **Brush Radius** - Bigger brush (r=5) covers areas faster

### Better Designs

1. **Variety** - Mix tile types (normal + ice + hazard)
2. **Sightlines** - Don't block view of opponent spawn
3. **Escape Routes** - Always have 2+ ways to get away
4. **Hazard Zones** - Place danger at edges, not center
5. **Height Drama** - Add platforms but keep paths clear

### Fair 1v1 Maps

1. Start with **Duel** template
2. Apply **Radial 6x** symmetry
3. Mark safe spawns on opposite sides
4. Test playtest 3 times minimum
5. Save as version 1

### Speedrun/Parkour Maps

1. Use **Spiral** or **Bridge** template
2. Add HEIGHT variations
3. Place SPEED_BOOST tiles on path
4. Reduce HAZARD tiles
5. Focus on flow over danger

## File Format

Levels save as `.json` files. Example:

```json
{
  "id": "level_1704067200000",
  "name": "My First Arena",
  "description": "A balanced 2-player arena",
  "tiles": [
    {"coord": {"q": 0, "r": 0}, "ability": "NORMAL", "height": 0},
    {"coord": {"q": 1, "r": 0}, "ability": "ICE", "height": 0}
  ],
  "theme": "tron",
  "difficulty": "normal",
  "symmetry": "radial6"
}
```

You can share these `.json` files with friends!

## Next Steps

1. ✓ Create a level with a template
2. ✓ Add some special tiles
3. ✓ Apply symmetry
4. ✓ Playtest it
5. ✓ Save and share!

Then explore:
- Height variations for multi-level gameplay
- Hazard density for difficulty tuning
- Custom spawns and themed tile patterns
- Competitive balance testing

---

**Have questions?** Check `LEVEL_EDITOR_ARCHITECTURE.md` for detailed docs!
