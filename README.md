# Dropfall: Cyber Arena

Dropfall is a fast-paced, retro-styled 3D local and online multiplayer arena game built with Three.js and Rapier3D. Battle it out in a cyber arena, use boosts, and try to knock your opponent off the edge!

## Features
- **Local & Online Multiplayer:** 2-player competitive gameplay (local split-screen or online).
- **Mobile Support:** Play on iPhone with touch controls.
- **Desktop Apps:** Build and run on Mac and Windows.
- **Physics-based Combat:** Powered by Rapier3D for realistic collisions and movement.
- **Retro Cyberpunk Aesthetic:** Neon visuals, particle systems, and shockwave effects.
- **Customizable Settings:** Change themes (Cyber, Beach, Cracked Stone), sphere sizes, and more.

## Controls
- **Player 1:** `W` `A` `S` `D` to move, `SHIFT` to boost.
- **Player 2:** `ARROW KEYS` to move, `SHIFT` to boost.
- **Mobile:** Tap screen edges to move, green button to boost.

## Tech Stack
- [Three.js](https://threejs.org/) - 3D Rendering
- [Rapier3D](https://rapier.rs/) - Physics Engine
- [Zustand](https://github.com/pmndrs/zustand) - State Management
- [Vite](https://vitejs.dev/) - Build Tool
- [Electron](https://www.electronjs.org/) - Desktop Apps
- [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) - Online Multiplayer

## Installation & Running

### Web Version

1. Clone the repository:
   ```bash
   git clone https://github.com/DaniMo8/Dropfall.git
   cd Dropfall
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### Desktop Apps (Mac/Windows)

See [DESKTOP_BUILD.md](DESKTOP_BUILD.md) for complete instructions on building distributable desktop applications.

Quick start:
```bash
npm install
npm run electron:dev          # Run desktop app in dev mode
npm run desktop:build:mac     # Build Mac app
npm run desktop:build:win     # Build Windows app
```

## Version
**1.0 Public Release**

