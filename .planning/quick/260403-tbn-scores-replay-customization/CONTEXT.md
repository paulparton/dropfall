# Quick Task 260403-tbn: Player Scores, Replays, and Customization - Context

**Gathered:** 2026-04-03  
**Status:** Ready for planning

<domain>
## Task Boundary

Implement three interconnected player experience features:
1. **Scores/Wins**: Track wins per player across game sessions (like Street Fighter)
2. **Replay System**: Record and playback game footage; show replay of loser falling
3. **Character Customization**: Color and hat selection with live preview on setup screen

</domain>

<decisions>
## Implementation Decisions

### Scores Persistence & Display
- **Decision**: Scores persist in `store.js` during session (not across browser refreshes initially)
- **Rationale**: Session-based tracking keeps complexity low; can extend to localStorage later
- **UI Location**: Displayed prominently during game, reset when starting new match set
- **Format**: Simple counter (wins: 0) per player, displayed as "Player 1: 2 | Player 2: 1"

### Replay System Architecture
- **Decision**: Record complete frame history using a circular buffer (last N frames)
- **Rationale**: Enables both full-game replays and 1-3 second slow-motion falling shots
- **Playback Options**: Auto-play loser falling clip OR manual replay viewer
- **Storage**: In-memory only for MVP; can add export/download later
- **Shows at**: End of round (after winner determined, before next round)

### Character Customization
- **Decision**: Color palette = predefined set (8-12 colors); hats = 3-4 options from spritesheet
- **Rationale**: Avoids custom color picker complexity; uniform visual style
- **Live Preview**: Setup screen shows ball with selected color/hat combo in real-time
- **Application**: Color/hat selected at match start, maintained for full match session
- **AI Opponent**: Customizable via same controls in single-player mode

### Design System Constraints
- **Ball Colors**: Use existing platform/theme colors (arctic, beach, inferno, temple)
- **Hat Styles**: Simple shapes (crown, cap, visor, wizard hat) rendered via simple 3D geometry
- **UI Resolution**: Setup screen must work at 800x600 minimum

### Error Handling & Edge Cases
- **Multi-player Sync**: Replay data sent with minimal overhead (compressed frame IDs only)
- **Browser Memory**: Circular buffer auto-trims if exceeds 5MB
- **Customization Conflicts**: If AI and player pick same color, darken AI ball slightly

</decisions>

<specifics>
## Specific Ideas

- **Scores display**: Top-right corner during play, font size matches game UI scale
- **Replay clip**: 3-second window before falling detection + 1 second after fall
- **Hat rendering**: Use 3D spheres with texture offset, not separate geometry
- **Color categories**: 
  - Neon (bright): cyan, lime, magenta
  - Dark (shadowy): navy, charcoal, burgundy
  - Metallic (shiny): gold, silver, copper
  - Jewel (saturated): ruby, emerald, sapphire

</specifics>

<canonical_refs>
## Canonical References

- Store system: `src/store.js` (state management)
- Renderer: `src/renderer.js` (ball rendering, text overlay)
- Game loop: `src/main.js` (frame loop where data collection happens)
- Existing ball assets: `src/entities/Player.ts` (player ball definition)
- Setup screen: Currently missing — will create as modal overlay

</canonical_refs>
