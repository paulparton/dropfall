# Level Editor Architecture & User Guide

## Overview

The Level Editor is a comprehensive tool for creating, editing, and testing hexagonal tile-based arena levels for the Dropfall game. It features a full hex grid system, symmetry tools, template library, and real-time validation.

## Architecture

### Core Components

```
Level Editor System
├── Types (LevelEditor.ts)
│   ├── HexCoord - Axial hex coordinate system
│   ├── EditorTile - Individual tile data
│   ├── LevelData - Complete serialized level
│   ├── EditorTool - Tool types
│   └── EditorState - Full editor state
│
├── Utils
│   ├── hexMath.ts - Coordinate math & algorithms
│   ├── templates.ts - Arena templates (10+ pre-made designs)
│   ├── validation.ts - Level validation & suggestions
│   └── LevelEditor.ts - Main controller
│
├── State Management (store.ts)
│   └── Zustand store with undo/redo history
│
├── Rendering (EditorRenderer.ts)
│   ├── Three.js 3D visualization
│   ├── Hex mesh generation
│   ├── Interactive selection
│   └── Ghost preview system
│
└── UI (EditorUI.ts)
    ├── Toolbar (tools & actions)
    ├── Library (templates)
    ├── Inspector (properties)
    └── Status bar
```

### Coordinate System

The editor uses **Axial Hex Coordinates (q, r)** with optional height (y):

```typescript
interface HexCoord {
  q: number;      // Horizontal position
  r: number;      // Diagonal position
  y?: number;     // Height displacement (0 = base level)
}
```

**Advantages:**
- Efficient storage and lookup
- Natural for 6-directional movement
- Easy distance calculations
- Simple neighbor finding

**Conversion Functions:**
```typescript
hexToPixel(q, r, spacing)      // Convert to 3D world coords
pixelToHex(x, z, spacing)      // Convert back from world coords
hexDistance(a, b)              // Calculate distance
hexesInRadius(center, r)       // Get all hexes in radius
hexNeighbors(coord)            // Get 6 adjacent hexes
```

## Features

### 1. **Core Tools**

#### SELECT Tool
- Click to select single tile
- Drag to marquee select multiple tiles
- Hold SHIFT to add to selection
- Visual yellow highlight on selection

#### MOVE Tool
- Click and drag to move selected tiles
- Snap to grid (toggle in inspector)
- Ghost preview shows destination
- All selected tiles move together

#### PAINT Tool
- Left click to place tiles with selected ability
- Brush radius from 1 to 10 tiles
- Paint with: Normal, Ice, Portal, Bonus, Empty, Hazard, Red Dropper, Speed Boost
- Falloff modes: Linear, Square, Smooth

#### ERASE Tool
- Left click to remove tiles
- Respects brush radius
- Shift-click to erase all selected

#### HEIGHT Tool
- Adjust Y position (vertical displacement)
- Create multi-level arenas
- Range: -5 to +5 units
- Useful for ramps and platforms

#### BRUSH_HAZARD Tool
- Randomly assign hazard property
- Probability controlled by strength slider
- Area selected by radius
- Great for creating danger zones

#### SYMMETRY Tool
- Apply mirroring to selection
- Modes: Bilateral, Radial 3x, Radial 6x
- Perfect for competitive maps

#### BOUNDARY Tool
- Auto-generate perimeter walls
- Prevents fall-offs
- Creates invisible safe zones

### 2. **Template Library**

**Basic Templates:**
- **Hexagon** - Classic symmetrical arena (any radius)
- **Ring** - Donut-shaped gameplay space
- **Bridge** - Narrow crossing with drop zones
- **Cross** - 4 corridors meeting in center
- **Diamond** - Rotated square, compact arena
- **Triangle** - 3-sided unique flow

**Advanced Templates:**
- **Island** - Central platform with moat
- **Spiral** - Continuous winding path
- **Obstacle Course** - Multiple islands with gaps

**Competitive Templates:**
- **Duel** - 1v1 perfectly symmetrical arena
- **King of the Hill** - Raised central platform
- **Corners** - Safe bases with chaotic center

Each template is scalable via radius parameter.

### 3. **Smart Snapping**

When **Snap Toggle** is enabled:
- Tiles align to nearest valid hex coordinate
- Ghost/silhouette preview shows landing position
- Prevents invalid overlaps
- Accounts for height differences

### 4. **Advanced Features**

#### Hazard Density Brush
```typescript
// Apply hazard to ~30% of tiles in radius 3
selectTiles(myRadius)
applyHazardBrush(strength: 0.3, radius: 3)
```

#### Boundary Generator
```typescript
// Auto-place boundary walls around perimeter
applyBoundary()
// Creates invisible walls that prevent falling
```

#### Symmetry Mirroring

**Bilateral Symmetry:**
- Mirrors across Q axis
- Perfect for 2-player fairness

**Radial Symmetry:**
- 3-way or 6-way rotation
- Creates balanced competitive maps

```typescript
applyBilateralSymmetry(tiles, 'q')
applyRadialSymmetry(tiles, 6)  // 6-way
```

#### Height Displacement
- Set individual hex heights
- Create ramps and multi-layered play
- Heights range from -5 to +5 units

### 5. **Level Validation**

Automatic validation checks:
- ✓ Minimum tile count
- ✓ Hazard density ratio
- ✓ Connectivity (no isolated islands)
- ✓ Symmetry compliance
- ✓ Reasonable height differences
- ✓ Game parameter ranges
- ✓ Boundary protection

**Validation Results:**
```typescript
interface LevelValidationResult {
  isValid: boolean
  errors: LevelValidationError[]
  statistics: {
    totalTiles: number
    emptyTiles: number
    hazardTiles: number
    averageHeight: number
    symmetryScore: number  // 0-1
  }
}
```

### 6. **Playtest Mode**

"Instant Test" Button:
1. Validates level
2. Serializes to JSON
3. Launches game with current level
4. 2-player or AI-Hard mode options

```typescript
playtestLevel()
// Stores in sessionStorage as 'editorLevel'
// Game loads and plays test
```

## User Workflow

### Creating a New Level

1. **Start with Template**
   - Select from library (e.g., "Hexagon" with radius 5)
   - Instant arena generation

2. **Refine with Tools**
   - Use PAINT to add special tiles
   - ERASE to create gaps
   - HEIGHT to add variation

3. **Apply Symmetry**
   - Select key areas
   - Apply SYMMETRY tool
   - Ensures fairness

4. **Add Hazards**
   - Use BRUSH_HAZARD for random density
   - Strategically place RED_DROPPER tiles
   - Balance difficulty

5. **Validate**
   - Inspector shows error count
   - Suggestions for improvement
   - Green checkmark when ready

6. **Playtest**
   - Click "Playtest" button
   - Play full game with level
   - Return to editor to iterate

7. **Save**
   - "Save" button exports as JSON
   - Can be loaded back later
   - Shareable with other players

### Example Session

```
New Level
└─ Select "Cross" template (radius 4)
   └─ Add height variation (Height tool)
      └─ Paint bonus tiles (PAINT + BONUS)
         └─ Apply radial symmetry (SYMMETRY 6x)
            └─ Generate boundaries (BOUNDARY)
               └─ Validate (✓ No issues)
                  └─ Playtest
                     └─ Great! Save it
```

## Keyboard Shortcuts

- **Ctrl+Z** - Undo
- **Ctrl+Y** - Redo
- **Delete** - Erase selection
- **Right Click** - Pan camera
- **Scroll** - Zoom in/out
- **Number Keys** - Switch tools (1-8)

## File Format

Levels are stored as JSON:

```json
{
  "id": "level_1704067200000",
  "name": "My Arena",
  "description": "A competitive 1v1 arena",
  "tiles": [
    {"coord": {"q": 0, "r": 0}, "ability": "NORMAL", "height": 0},
    {"coord": {"q": 1, "r": 0}, "ability": "ICE", "height": 0},
    ...
  ],
  "theme": "tron",
  "difficulty": "normal",
  "symmetry": "radial6",
  "destructionRate": 3.0,
  "iceRate": 2.0,
  "portalRate": 8.0,
  "bonusRate": 6.0,
  "author": "Player"
}
```

## Performance Considerations

### Optimization Strategies

1. **Shared Geometry**
   - One hex mesh reused for all tiles
   - Reduces memory footprint
   - Faster rendering

2. **Viewport Culling**
   - Only render tiles within `renderDistance` of camera
   - Large levels stay performant

3. **Lazy Material Creation**
   - Materials cached and reused
   - One material per tile ability type

4. **Efficient Selection**
   - Selected tiles tracked by coordinate string key
   - O(1) lookup time

### Large Level Support

- Supports 500+ tiles without performance issues
- Pan and zoom remain responsive
- Editor suitable for intricate design

## Integration with Game

### Loading a Level

```typescript
// In game initialization
const editorLevelData = sessionStorage.getItem('editorLevel')
if (editorLevelData) {
  const level = JSON.parse(editorLevelData)
  arena.loadFromLevelData(level)
}
```

### Tile Ability Mapping

```typescript
// Editor → Game ability
NORMAL → Standard tile (no effect)
ICE → Slippery surface
PORTAL → Teleport tile
BONUS → Extra points
EMPTY → No tile (gap)
HAZARD → Red flashing → falling
RED_DROPPER → Tile drops after use
SPEED_BOOST → Increased momentum
BOUNDARY → Invisible wall / dead zone
```

## Best Practices

1. **Balance First**
   - Use templates as starting point
   - Apply symmetry for fairness
   - Test difficulty via playtest

2. **Visual Hierarchy**
   - Use height variation sparingly
   - Group similar tile types
   - Keep important areas visible

3. **Playtesting**
   - Test at least 3-5 rounds
   - Verify both player spawn areas
   - Check hazard difficulty

4. **Documentation**
   - Use meaningful level names
   - Add description for context
   - Tag for categorization

5. **File Management**
   - Save iterations (v1, v2, etc.)
   - Export finals to shared folder
   - Version control recommended

## Future Enhancements

Potential additions:
- Pre-built puzzle challenges
- AI difficulty simulation
- Multiplayer level voting
- Level analytics (win rates by tile type)
- Custom tile color themes
- Animated tile effects in editor
- Collaborative editing
- Level leaderboards

---

## Architecture Pseudocode

### HexGridManager

```typescript
class HexGridManager {
  private tiles: Map<string, EditorTile>
  private geometries: SharedGeometries
  private materials: Map<string, Material>
  
  public addTile(coord: HexCoord, ability: TileAbility): void
  public removeTile(coord: HexCoord): void
  public getTile(coord: HexCoord): EditorTile | undefined
  public getTilesInRadius(coord: HexCoord, radius: number): EditorTile[]
  public validate(): LevelValidationResult
  public serialize(): LevelData
}
```

### SelectionSystem

```typescript
class SelectionSystem {
  private selected: Set<HexCoord>
  private groups: Map<string, TileGroup>
  
  public select(coords: HexCoord[], additive?: boolean): void
  public deselect(coords: HexCoord[]): void
  public selectByRect(p1: HexCoord, p2: HexCoord): void
  public groupSelected(name: string): TileGroup
  public ungroupSelected(): void
  public getSelectedCoords(): HexCoord[]
}
```

### SymmetrySystem

```typescript
class SymmetrySystem {
  public applyBilateral(tiles: EditorTile[], axis: 'q'|'r'): EditorTile[]
  public applyRadial(tiles: EditorTile[], rotations: 3|6): EditorTile[]
  public validateSymmetry(level: LevelData): SymmetryReport
}
```

### BoundaryGenerator

```typescript
class BoundaryGenerator {
  public generatePerimeter(level: LevelData): EditorTile[]
  public setBoundaryType(type: 'invisible'|'walls'|'none'): void
  public visualizeBoundary(level: LevelData): void
}
```
