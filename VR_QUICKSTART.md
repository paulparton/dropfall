# Dropfall VR — Quick Start Guide

This guide gets Dropfall running on an Oculus Quest 2 or Quest 3 in about 5 minutes.

## Prerequisites

Before you begin, make sure you have:

- Oculus Quest 2 or Quest 3 headset
- PC/Mac on the same WiFi network as the Quest
- Node.js 18+ installed on the PC/Mac

## Setup & Install

1. Clone the repository:

```bash
git clone <your-repo-url>
cd dropfall
```

2. Install dependencies:

```bash
npm install
```

3. HTTPS support note:

- This project uses `@vitejs/plugin-basic-ssl` (already listed in `package.json`) so the dev server can run over HTTPS, which WebXR requires.
- The generated certificate is self-signed and intended for local development only.

## Running the VR Server

1. Start the VR/dev server:

```bash
npm run dev:vr
```

2. What this does:

- Runs Vite with host enabled (`--host`) so it is reachable from other devices on your network.
- Uses HTTPS via the Vite basic SSL plugin.
- Defaults to port `5173`.

3. In terminal output, find your network URL, typically:

```text
https://192.168.x.x:5173
```

4. If you need to find your local IP manually:

- Windows: `ipconfig`
- macOS/Linux: `ifconfig` or `ip addr`

## Connecting from Quest

1. Put on your headset.
2. Open **Meta Quest Browser** (the built-in browser).
3. Navigate to `https://<your-pc-ip>:5173`.
4. You will see a certificate warning (self-signed cert). Tap **Advanced** -> **Proceed to site**.
   - This is expected and safe for your own local network.
5. The game loads in flat mode first.
6. Tap the **Enter VR** button at the bottom of the screen.
7. Grant VR permissions if prompted.
8. You are in VR.

## VR Controls

| Control | Action |
|---------|--------|
| Left Thumbstick | Move player (forward/back/left/right) |
| Right Trigger | Boost |
| Left Trigger | Boost (alternate) |
| A Button | Menu / Restart |
| B Button | Return to menu |
| Head movement | Look around freely |

## Gameplay in VR

- You view the arena from above, like a tabletop game.
- Your player is controlled with the left thumbstick.
- The AI opponent plays automatically.
- Scores and game status appear as floating text above the arena.
- The camera smoothly tracks the action.

## Troubleshooting

### "WebXR not available" or no Enter VR button

- Ensure you are using HTTPS, not HTTP.
- Use the built-in **Meta Quest Browser** (not a sideloaded browser).
- Restart the Quest browser and reload the page.

### Certificate error won't let me proceed

- On the warning page, tap **Advanced** then **Proceed to [IP] (unsafe)**.
- This is normal for a self-signed local dev cert.
- If no **Advanced** option appears, try typing `thisisunsafe`.
  - Some Chromium-based warning pages accept this bypass.

### Game is laggy/stuttering

- Close other apps on the Quest.
- Use 5GHz WiFi instead of 2.4GHz when possible.
- Reduce open browser tabs.
- VR mode in this project already reduces effects for Quest performance.

### Can't find my PC's IP address

- **macOS**: `ifconfig | grep "inet "` and look for `192.168.x.x`
- **Windows**: `ipconfig` and look for **IPv4 Address** under your WiFi adapter
- **Linux**: `ip addr show` or `hostname -I`

### Controller not responding

- Confirm controllers are paired and tracking.
- Check controller battery levels.
- Point at the page and click once before entering VR.

## Production Deployment (Optional)

If you want to share beyond your local network:

1. Build production assets:

```bash
npm run build
```

2. Upload `dist/` to any HTTPS-capable host (Netlify, Vercel, Cloudflare Pages, etc.).
3. Open the public HTTPS URL in the Quest browser.
4. No local self-signed certificate warning should appear on properly configured hosting.

## Development Notes

- VR mode is additive: the game still runs as normal in desktop browsers.
- For Quest performance, VR rendering bypasses post-processing effects (such as bloom).
- Physics uses a fixed timestep regardless of VR framerate.
- `EffectComposer` is not used in VR stereo rendering; direct `renderer.render()` is used instead.
