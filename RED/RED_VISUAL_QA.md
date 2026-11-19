# R.E.D. Visual and Technical QA

## Summary

The final pass fixed several confirmed animation and resource-lifecycle defects, smoothed third-person camera follow, added lightweight weapon/spirit effects, and reduced terrain-construction work. The production build and local browser smoke tests pass. Performance is **not certified for release hardware**: the only FPS sample available here was a software-rendered headless browser, and real-device profiling was not possible.

## Changes made

- Fixed humanoid knee animation: the rig searched for a `Group` where the lower-leg joint is a `Bone`.
- Passed blocking and airborne state into the character rig; added blended block/jump poses and eased locomotion transitions.
- Added third-person camera follow smoothing while keeping first-person view immediate.
- Added a reusable sword-swing trail and a pulsing, bobbing spirit aura.
- Disposed of spirit and loot GPU resources when dismissed, collected, or cleared. Unregistered input/UI/canvas/window listeners, closed IndexedDB on disposal, cleared the world scene, and cancelled pending respawn timers.
- Precomputed the terrain height grid once and reused neighboring heights for slope coloring. Terrain generation now evaluates the height field once per vertex instead of once for the vertex plus four slope samples. Curve-distance scans compare squared distances and take one square root per query; removed temporary landmark arrays and per-vertex reduction callbacks. Reduced the high-frequency components in the procedural ground texture.

## Tests actually run

| Area | Result |
|---|---|
| Production build | `npm run build` passed (TypeScript and Vite). |
| Desktop menu/game | Playwright Chromium, WebGL2, 1440×900: menu and four races appeared; selected Elf, created a character, opened Pack and Settings, closed the panel with Escape, sent keyboard movement and canvas-attack input, and observed no browser/page errors. Player displacement and hit outcomes were not asserted. |
| Save/load | In the same browser context, verified the character record in IndexedDB, reloaded, continued the saved character, and verified the HUD name. |
| Mobile portrait | Playwright touch/coarse-pointer emulation, 390×844: created a Beastkin character; checked race-card sizing, HUD visibility, 44×44 action-button bounds, verified joystick thumb movement, camera toggle, spirit action, attack input, and block press/release. |
| Mobile landscape | Playwright touch/coarse-pointer emulation, 844×390: verified touch controls remain visible, all seven action buttons stay within the viewport, and the document has no horizontal overflow. |
| Animation poses | Direct browser checks of the procedural rig confirmed idle breathing, walking knee motion, distinct walking/running gait, and attack, block, jump, damage, and death poses. A direct camera check confirmed eased third-person follow. These isolate rig/camera state; they do not prove every state is triggered correctly by a full gameplay encounter. |
| Whitespace | `git diff --check` passed. |
| GitHub Pages | The Actions deployment workflow succeeded for commit `f5b9a59edfdb8eed530bb902bec793cae323885b`, but the live browser smoke test failed: the root serves an HTML entrypoint referencing `./src/main.ts`, returned as `video/mp2t`, and the game menu never appears. Pages is configured for legacy publishing from `main` / `/`, not the workflow artifact. |

### Not verified in this pass

- Real Android/iOS devices, physical safe-area insets, or mobile GPU behavior.
- Actual damage/block mitigation, creature kills/rewards, death/respawn, companion following/attacks, or long-session save stability.
- Runtime behavior of every panel/control, asset-load fallback paths, memory/VRAM usage, or repeated scene creation/disposal under a profiler.
- Live menu/game startup: the deployed root does not serve the Vite production build, so live gameplay and save/load remain unverified.

The menu, character creation, race selection, continue/save path, keyboard movement input, panel navigation, touch layout, joystick input, and isolated animation poses were exercised as described above. Other features should not be considered fully gameplay-verified.

## Performance findings

- Five-second render-loop samples against the **production preview** in headless Chromium 159 using SwiftShader software rendering measured about **1 FPS at 1440×900** and **3 FPS at 390×844**. Instrumented WebGL submissions averaged about **216 calls/frame** and **135 calls/frame**, respectively. Startup to the interactive menu took about 6.1 seconds on the desktop viewport and 2.8 seconds on the mobile viewport. The environment exposed two hardware threads and selected the mobile graphics profile. These results identify a slow software-rendering test environment, not representative device FPS; they are not a pass against a 30/60 FPS target.
- The production build emits `three` at 573.26 kB (147.28 kB gzip) and `rapier` at 2,139.14 kB (781.79 kB gzip), so Vite reports the existing 500 kB chunk-size advisory. `three-addons` is 50.24 kB (15.04 kB gzip); the application chunk is 95.45 kB (30.83 kB gzip). No bundle-splitting or dependency changes were made in this pass.
- The world already uses chunked instanced vegetation, simplified radial vegetation meshes, capped pixel ratio, and disabled shadows/antialiasing on constrained/coarse-pointer profiles. The vegetation simplification is **static by valley radius**, not camera-distance-adaptive LOD.
- The terrain-generation reduction is source-level verified, but startup-time improvement was not benchmarked. GPU frame timing, real-device FPS, and memory/VRAM profiles remain unknown.

## Remaining visual limitations

- The valley, characters, creatures, vegetation, and effects are procedural low-poly geometry. No imported production character/world models, authored PBR texture sets, or animation clips are present.
- Current rigs and the new weapon/spirit effects are lightweight procedural approximations, not production skeletal animation or authored VFX.
- The scene has atmospheric fog and depth, but no volumetric fog, dynamic camera-distance LOD, or hardware-validated shadow quality. The spirit aura is a small point-particle effect.
- The game remains a playable prototype; the cave is a landmark entrance rather than a finished dungeon, and several panels represent status rather than full game systems.

## Mobile compatibility

Portrait (390×844) and landscape (844×390) were checked in Chromium touch/coarse-pointer emulation. The tested HUD controls were visible, at least 44×44 CSS pixels, and within the viewport; the joystick responded to pointer movement. CSS safe-area insets are present, but notches, browser chrome, device-specific scaling, and physical touch latency were not tested on a device.

## Deployment status

The Actions workflow succeeded for commit `f5b9a59edfdb8eed530bb902bec793cae323885b`, but this does **not** mean the production build is live. Pages is configured as legacy publishing from `main` / `/`. The URL returns HTTP 200, but serves the source `index.html` referencing `./src/main.ts`; that TypeScript request also returns HTTP 200 with MIME type `video/mp2t`, which browsers reject as a module. A live Playwright smoke test confirmed that the menu never appears. An attempt to switch Pages to workflow publishing was rejected with HTTP 403 due to insufficient integration permissions. A repository admin must set **Settings → Pages → Build and deployment → Source → GitHub Actions**, then rerun the `Deploy RED to GitHub Pages` workflow. Do not consider the live game verified until the menu and gameplay are smoke-tested at the Pages URL.

## Visual transformation stage: forest and terrain

- Replaced the instanced forest's faceted low-detail trunk/canopy primitives with bent tapered trunks, irregular subdivided canopy geometry, and reduced-detail distant variants. Seeded placement, foliage wind, chunk batching, collision, and gameplay APIs are unchanged.
- Added Poly Haven Forest Ground 04 1K diffuse, OpenGL normal, and roughness maps to the terrain material. The prior generated ground texture remains the fallback if a map fails to load. Source and license are recorded in `public/assets/ASSET_MANIFEST.md`.
- `npm run build` passes after both changes. No browser screenshot, console/network check, runtime asset-load check, rendered-quality inspection, FPS sample, or physical-device performance test was performed during this stage.
- This is a limited environment-material/geometry improvement, **not** the requested full transformation. Rigged high-quality player, companion, and enemy models, authored tree/rock meshes, wider PBR environment coverage, and cinematic 3D menu work remain unimplemented; the current actors and much of the world are still procedural prototype art.

## Follow-up visual/combat pass

- Added race-colored, animated capes and a longer, shaped sword blade to make the player silhouette and weapon more distinct while retaining the procedural rig and existing gameplay interfaces.
- Added a camera-mounted first-person sword and armored arm with beveled steel, edge highlights, fuller, wrapped grip, guard, and pommel. The view model sways with movement and follows the attack timing; it remains separate from the hidden third-person rig.
- Delayed combo damage to align with the visible sword strike and added an expanding, sequence-colored impact ring alongside the existing hit sparks.
- Expanded the sword-swing arc and synchronized its lifetime with the attack animation.
- Validation for this follow-up: `npm run build` and `git diff --check` pass. First-person appearance and full in-browser combat/device profiling were not rerun.
