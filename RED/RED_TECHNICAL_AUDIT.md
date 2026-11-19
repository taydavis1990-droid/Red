# R.E.D. Technical Audit

**Inspected:** 2026-11-18
**Repository state:** `main`, commit `c1b7ed1` (`Improve combat feedback and attack timing`); worktree clean before this audit.
**Baseline validation:** `npm run build` passed (TypeScript and Vite). Vite reports large `three` (574.76 kB) and `rapier` (2,139.14 kB) output chunks.

This audit is based on the tracked source and configuration present at the inspected commit. It supersedes conflicting statements in `RED_VISUAL_AUDIT.md` where that earlier document describes an older project revision. No game code or assets were changed as part of this audit.

## Technology and entry points

- **Language/runtime:** strict TypeScript, ES modules, browser DOM/CSS, target ES2022. No UI framework or test/lint runner is configured.
- **Build/development:** Vite 6 (`package.json`, `vite.config.ts`); `npm run build` runs `tsc -b && vite build`.
- **Rendering:** Three.js 0.170 WebGLRenderer and scene graph. The app binds `#game-canvas` in `src/main.ts` and owns the scene/render loop through `src/game/Game.ts`.
- **Physics:** Rapier 3D compat 0.15.1, initialized asynchronously by `Game.start()`. Player and creatures use kinematic rigid bodies, colliders, and character controllers; the environment provides fixed colliders.
- **Persistence:** browser IndexedDB through `src/core/SaveManager.ts`.
- **Hosting:** the GitHub Actions workflow builds `dist` and deploys a Pages artifact. `vite.config.ts` uses `base: './'`; `index.html` uses a relative module entry. These support project-subpath URLs, but repository files alone cannot confirm the Pages site setting or live deployment.

## Game lifecycle and render pipeline

`src/main.ts` creates `Game`, starts it, and replaces the interface with a fatal-startup message if initialization fails. `Game` selects a graphics profile, creates the WebGL renderer and shared asset manager, binds input/UI callbacks, initializes Rapier and the world, opens/loads the local save, and starts the render loop.

Each frame updates the world atmosphere and transient hit effects, then either updates menu presentation or gameplay before rendering. Gameplay orchestration in `Game` owns combat targeting/timing, XP/rewards, interactions, landmarks, companion/spirit callbacks, prompts, UI state, and periodic persistence. The current frame loop sets Rapier's timestep from the clamped frame delta (with a 1/120 minimum) and calls `physics.step()` during gameplay.

## Graphics and assets

- `src/core/GraphicsConfig.ts` defines three automatic profiles (`high`, `balanced`, `mobile`), selecting based on pointer type, hardware thread count, and reported device memory. It configures antialiasing, shadows, shadow-map size, pixel ratio, anisotropy, lighting intensities, and exposure. It does **not** yet expose Low/Medium/High/Ultra choices or a quality control in Settings.
- `Game` configures ACES tone mapping, sRGB output, soft shadow maps, and a capped pixel ratio. World lighting is procedural, with hemisphere and directional lights, fog, and a generated sky.
- `src/core/AssetManager.ts` has lazy GLTF loading with cloned scenes/animation clips, texture caching, PBR map loading for base color/normal/roughness/metallic/AO, project-relative URL resolution, explicit load-error reporting, and disposal. Failed models return the caller-supplied procedural fallback. No imported model or texture is currently registered or shipped.
- `public/assets/ASSET_MANIFEST.md` is an empty manifest template. There are no purchased or third-party assets to verify; no external asset source/author/license should be claimed.
- Procedural actor materials are mostly toon-shaded, with some standard metallic accessories. PBR capability in the loader does not make the existing actors/world use authored PBR textures.

## Player, races, movement, camera, and combat

- `src/core/types.ts` defines Human, Elf, Dwarf, and Beastkin race data and starting attribute bonuses. `createCharacter()` initializes level, inventory, equipment, companion count, and discovered-location data.
- `src/player/Player.ts` owns the kinematic capsule/controller, health/stamina/mana, sprint/jump/block, damage reduction, and the visual-rig update. The controller samples the world surface-height function.
- `src/actors/CharacterRig.ts` builds four visually differentiated original procedural humanoid rigs with face details, clothing/armor, weapon, and race details such as elf ears, dwarf stature/beard, and Beastkin ears/tail. Joints are `THREE.Bone` nodes with geometry attached to the bones; there is no skinned-mesh skeleton or imported animation-clip playback. Idle, movement, attack, block, jump, damage, and death posing is procedural.
- `src/player/CameraManager.ts` provides first- and third-person modes, mouse/touch-look input, and smoothed third-person follow.
- `Game` performs a timed three-step sword combo against one eligible forward-facing target, applies damage/knockback, creates impact particles, and coordinates death/respawn, XP, loot, and level gains. Existing combat logic is not a full action-RPG combat system and should be preserved during presentation work.

## Creatures and companion

- `src/creatures/Creature.ts` owns capsule physics, health, mood, AI, attack windup/cooldown, knockback, and health-bar state. Existing creature kinds are wolf, deer, and bear.
- `src/actors/CreatureRig.ts` creates original procedural quadruped models and idle/locomotion/attack/damage/death poses.
- `src/creatures/CreatureSystem.ts` spawns a fixed group of wolves, deer, and bears, and manages wolf taming/following, companion attacks, and a temporary spirit-wolf combat ability.
- Goblins, skeletons, trolls, dragons, boss encounters, wildlife beyond these three kinds, and a reusable broader creature content catalog are not present.

## World and environment

- `src/world/World.ts` defines the scene, spawn, and four persistent landmark identities: Elderwatch Ruins, Mossfall Cave, Whispering River, and Ashen Camp.
- `src/world/WorldEnvironment.ts` creates a fixed 120-unit seeded valley with a height-field terrain mesh, vertex/material color variation, generated repeating ground texture, terrain-trimesh collision built from the same sampled positions, fixed boundary colliders, paths, a curved river/bank, mountain ring, clustered forests, shrubs, grass/ferns/flowers, rocks/logs, ruins, cave entrance, and camp.
- Forest/ground vegetation is grouped into `InstancedMesh` batches by spatial chunk. Some content uses simplified distant geometry based on radial distance; this is static procedural LOD, not camera-distance streaming. Instancing and renderer frustum culling are already in use for suitable scenery.
- Wind sway is injected into instanced foliage through a custom material shader; particles, fog, animated daylight color/intensity, and generated ambient audio add atmosphere.
- Terrain visual and collider vertex positions share the sampled height field, unlike the stale flat-collider statement in `RED_VISUAL_AUDIT.md`. There is no streaming/large-world system, full biome variation, water simulation, or dynamic vegetation LOD.

## Menu, HUD, controls, and saves

- `src/ui/UI.ts` builds a DOM/CSS menu, race/name selection, continue button, race details, HUD, touch controls, toast notifications, and panels for Pack, Gear, Attributes, Companion, Quests, Map, and Settings.
- `Game` creates an actual Three.js character rig for the selected race in the menu scene; it animates/rotates as a live preview. The cinematic view uses the same procedural valley and lighting. This is not a static screenshot or imported model.
- The HUD displays player identity/level, health/stamina/mana/XP, companion state, camera mode, prompts, and desktop/mobile actions. Inventory/equipment/attributes/companion/map/journal panels exist, but equipment management and quest progression are placeholders; the map is a stylized landmark schematic, not a navigable world map.
- `src/core/InputManager.ts` supports WASD, sprint, jump, block, camera, attack, interact, spirit, inventory, mouse drag/lock look, a virtual touch joystick, and pointer-based touch actions. `src/styles.css` includes coarse-pointer layouts, touch targets, safe-area insets, compact landscape adjustments, and panel/menu breakpoints. Physical-device behavior is not established by source inspection.
- `SaveManager` stores one local character at IndexedDB `red-forgotten-valley` / `saves` / `main`, version 1. It includes a version-0-to-1 migration and merges default fields; save format changes require versioned migration.

## Deployment and project file map

The workflow at `.github/workflows/deploy.yml` runs `npm ci`, `npm run build`, uploads `dist`, and deploys it via GitHub Pages Actions. `vite.config.ts` and `index.html` use relative paths. A live Pages smoke test and Pages repository setting were not verified in this audit.

| Area | Key files |
| --- | --- |
| Startup and page shell | `index.html`, `src/main.ts`, `src/styles.css` |
| Renderer, lifecycle, combat orchestration | `src/game/Game.ts` |
| Graphics, assets, controls, save schema | `src/core/GraphicsConfig.ts`, `src/core/AssetManager.ts`, `src/core/InputManager.ts`, `src/core/SaveManager.ts`, `src/core/types.ts` |
| Player and camera | `src/player/Player.ts`, `src/player/CameraManager.ts` |
| Actor rigs | `src/actors/ActorGeometry.ts`, `src/actors/CharacterRig.ts`, `src/actors/CreatureRig.ts` |
| Creature AI and companion systems | `src/creatures/Creature.ts`, `src/creatures/CreatureSystem.ts` |
| World, ambience, and audio | `src/world/World.ts`, `src/world/WorldEnvironment.ts`, `src/world/AmbientAudio.ts` |
| UI | `src/ui/UI.ts`, `src/styles.css` |
| Asset license record | `public/assets/ASSET_MANIFEST.md` |
| Build and Pages deployment | `package.json`, `tsconfig.json`, `vite.config.ts`, `.github/workflows/deploy.yml` |

## Verified baseline and open limitations

- Verified in this pass: `npm run build` succeeds. No automated test or lint scripts are defined.
- The existing `RED_VISUAL_QA.md` documents prior browser-emulation runs and a Pages configuration problem at an earlier revision. Those results are historical; this audit did not independently repeat browser/gameplay or live deployment tests.
- No production-quality rigged character/creature GLB, authored PBR texture set, or external licensed content is present. The current procedural models are substantial original prototype art, but not realistic commercial character assets.
- At the audit snapshot, the requested four quality presets and in-game selector were not yet present. The first post-audit graphics stage now adds Low/Medium/High/Ultra settings, automatic device-aware defaults, and runtime updates for render scale, shadows, lighting, and anisotropy. Antialiasing remains fixed at renderer startup. Advanced graphics such as volumetric fog/AO, modern authored models and textures, dragon/enemy roster expansion, comprehensive RPG quests/map/equipment, and broad device QA remain future work.
- The known large Three.js and Rapier bundles are a startup/download concern. Device FPS, GPU memory, and actual mobile performance are not certified by the production build.

## Safe implementation boundaries

Keep the current renderer/Three.js/Rapier stack and preserve player/creature physics, collision and gameplay APIs, race stats, combat timing, landmark identifiers, UI action callbacks, save database/store/key/schema, and relative Pages asset URLs unless a specific tested migration or gameplay fix requires a change. Implement visual iterations independently from physics ownership and register only assets whose files and licenses have been verified.

## Post-audit implementation: graphics quality settings

The graphics foundation now defines four quality levels and selects Low/Medium/High/Ultra from reported CPU, memory, and pointer capabilities. The in-game Settings panel applies changes to pixel ratio, shadow enablement/map size, world lighting, and cached/future texture anisotropy. Antialiasing is set at renderer creation and cannot be changed in place. The production build passes after this change; no browser/device performance certification was performed.
