# Dropfall V2 — Star Circuit

## Product direction

Dropfall V2 keeps the original physics duel and multiplayer rule system, but presents it as a joyful, tactile toybox competition. The target is the clarity, responsiveness, charm, and “one more round” energy associated with the best first-party party games, expressed through an original Dropfall identity rather than copied characters, artwork, audio, or trade dress.

The signature experience is **Star Circuit**: bright molded arena pieces suspended in a celebratory dusk sky, chunky cream-and-color UI cards, oversized reactions, and clear coral/blue player language.

## V2 pillars

1. **Readable in one glance** — player, score, boost, hazards, room ownership, and settings permissions use strong shape and color separation.
2. **Every action answers back** — collisions produce particles, shockwaves, light, sound, impact typography, and bounded camera response without changing authoritative physics.
3. **One game, one interface** — solo, local, and online use the same match-setting vocabulary and visual components.
4. **Friendly competition** — copy and presentation invite rematches rather than presenting the game as a technical simulator.
5. **Works on the couch or phone** — desktop retains a wide broadcast layout; mobile setup becomes a scrollable single-column flow with full-width player cards.

## Implemented in this branch

- New V2 play plaza, logo treatment, mode cards, copy, quick guide, and build identity.
- New Star Circuit platform and sky shaders behind the backward-compatible `tron` theme key.
- Smoother player silhouettes and brighter, clearer customization previews.
- Unified V2 styling for setup, shared match rules, online connection, room browser, live room setup, HUD, countdown, pause, results, and power-up notices.
- Repeating collision feedback restored by decrementing the collision cooldown.
- New presentation-only game-feel system with impact words, boost-hit callouts, camera shake, and reduced-motion support.
- Collision shockwaves and scene light flashes added to the existing particles, lightning, and procedural audio.
- Mobile setup rebuilt as a usable vertical flow instead of clipped side-by-side cards.
- Multiplayer packet-order race fixed: joining no longer fails when another player's customization color has not arrived yet.
- User-facing theme labels now show `Star Circuit` rather than the internal compatibility key.

## Verification bar

- TypeScript: clean.
- Unit/integration: 252 tests passing.
- Production build: successful.
- Desktop browser: menu, setup, Star Circuit gameplay, HUD, and WebGL shaders verified.
- Mobile browser at 390 × 844: menu and setup verified without horizontal overflow.
- Two-client multiplayer: private room creation, guest entry, settings permissions, and host-to-guest live theme synchronization verified against a clean local server.
- Accessibility: focus-visible treatment, reduced-motion behavior, live status regions, and readable disabled controls retained.

## Next production investments

The next highest-return work is content rather than another visual rewrite: curate a small set of validated custom maps, add a short first-match tutorial, commission a cohesive original sound/music package, and run latency/soak testing with remote devices before public launch.
