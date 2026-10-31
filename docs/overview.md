# Encompass prototype

Encompass is a browser-local exploration prototype built with React, TypeScript, Vite, React Three Fiber/Drei, Three.js, and Zustand. It replaces the former square/coin game; the old save is left untouched under its previous storage key and is not migrated.

## What works

- The explorer moves continuously in a 0–359° heading (north is 0°, east 90°). Drag or click the compass, use its arrow keys (Shift for 15°), or use the +/- controls. The camera can be orbited and zoomed.
- The landscape is a single deterministic world shared by all local prototypes, with smoothly blended meadow, forest, mountain, desert, jungle, and river regions. Terrain is rendered in seamless nearby chunks; chunks are an implementation detail, not movement spaces. Coordinates are continuous and unbounded for this prototype.
- Glowing finds can be gathered when within reach. They add one resource to the 24-item satchel and unlock the corresponding field-note entry. Collected find IDs persist so they cannot be gathered twice. Resources can be voluntarily discarded one at a time to make space. Trail boots cost two wood and two herbs and increase away speed.
- The away choice immediately either resumes travel or sets up a stationary, protected camp. While the page is visible, the explorer moves at 0.9 units/second; while away, travel is calculated at 0.35 units/second (0.55 with trail boots) from the last saved timestamp. A camp stays still until the player chooses to keep travelling. Backgrounding, closing, reloading, and returning use page visibility/page lifecycle events; the world does not need a server process.
- The nearby travellers are deterministic **simulated placeholders**, not real players or a shared multiplayer session. Their online, away-travelling, and camped states are visible; waving is local feedback only. Trading, collaboration, and wagers are explicitly future features. There is no combat or offline item loss.

## Where to make changes

- `src/world.ts`: biome regions, smooth terrain, resource/discovery catalog, generated finds, placeholder travellers, movement math, and speed/capacity constants. The deterministic world is intentionally small in content but extends beyond the initial regions.
- `src/store.ts`: Zustand actions and the `encompass-journey-v1` localStorage save. `enterWorld`, `leaveWorld`, and `tick` settle travel at the correct speed; heading and camp changes settle the previous movement first. The `active` flag is deliberately not persisted so a reload accounts for elapsed time as away time.
- `src/components/Scene3D.tsx`: seamless vertex-colored terrain, procedural scenery, explorers, camp, find markers, and following orbit camera. Only nearby chunks are rendered.
- `src/App.tsx`: page lifecycle, compass, gathering prompt, nearby traveller, field notes, satchel/crafting, and away choice.
- `src/style.css`: world HUD, panels, and responsive layout.
- `tests/game.test.mjs`: Node's test runner loads the actual TypeScript modules through Vite to check movement, away travel, gathering, capacity, and crafting without additional dependencies.

The initial starter finds are fixed to make the interaction easy to see. Other finds are deterministic by world position. Offline simulation uses the device clock and is not authoritative; clearing browser storage clears the journey. There is no server, cross-device save, real-time multiplayer, real trading, or anti-cheat. The prototype does not cap away elapsed time. The page lifecycle is best-effort: if the browser is terminated without a final event, the last periodic save becomes the starting point for away calculation.

## Run and validate

```sh
npm install
npm run dev
npm test
npm run build
```

For manual checks, gather a glowing find and inspect both the satchel and field notes; turn the compass and observe continuous coordinates; choose camp and verify the coordinates stop, then choose travel and verify they resume. Reload or background the page in each away mode and check that the position advances at the reduced rate only when travelling. Inspect the encounter panel for the simulated-player disclosure.
