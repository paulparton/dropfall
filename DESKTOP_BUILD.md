# Desktop Build Setup for Dropfall

Dropfall now supports building and distributing as a desktop application for Mac and Windows using Electron and electron-builder.

## Installation

After cloning the project, install dependencies including Electron:

```bash
npm install
```

This will install Electron and electron-builder as dev dependencies.

## Development

### Run Desktop App in Development Mode

```bash
npm run electron:dev
```

This will:
1. Build the web app with Vite (`vite build`)
2. Launch the Electron app pointing to the built files
3. Open DevTools for debugging

### Run Web Version

```bash
npm run dev
```

Runs the Vite dev server with hot reload.

## Building

### Build for Current Platform

```bash
npm run desktop:build
```

Creates a distributable for your current OS (Mac or Windows).

### Build for Mac

```bash
npm run desktop:build:mac
```

Creates:
- `.dmg` (installer)
- `.zip` (portable version)

### Build for Windows

```bash
npm run desktop:build:win
```

Creates:
- NSIS installer (`.exe`)
- Portable executable

### Build for All Platforms

```bash
npm run desktop:build:all
```

Creates distributables for both Mac and Windows (requires cross-platform dependencies).

## Output

Built applications are in the `dist/` output folder:
- Mac: `Dropfall.dmg`, `Dropfall.zip`
- Windows: `Dropfall Setup.exe`, `Dropfall.exe` (portable)

## Configuration

Electron-builder settings are in `package.json` under the `build` key:

- **appId**: Unique identifier (com.dropfall.game)
- **productName**: Display name (Dropfall)
- **dirs.buildResources**: Icon/asset location (assets/)
- **files**: What gets bundled into the app

## Icons

To customize the app icon:

1. Create a PNG image (512x512 recommended) and save as `assets/icon.png`
2. The build system will automatically use it for the app icon

## Notes

- The app is packaged with the necessary `dist/` files (web build output)
- Node modules are NOT bundled; they're installed as dependencies
- Development dependencies (Electron, electron-builder) are not included in distributions
- The app runs as a standard web app inside an Electron wrapper

## Troubleshooting

### "electron not found"

```bash
npm install
```

### "Cannot find dist/index.html"

Make sure to build the web version first:

```bash
npm run build
npm run electron
```

### On Mac: "Cannot be opened because the developer cannot be verified"

This is expected for unsigned apps. To allow opening:

1. Right-click the app → Open
2. Or: `xattr -d com.apple.quarantine /Applications/Dropfall.app`

## Build for Distribution

For production builds with code signing:

1. Obtain code signing certificates
2. Set environment variables (see electron-builder docs)
3. Run: `npm run desktop:build:mac` or `npm run desktop:build:win`
