# R.E.D. Visual Overhaul Technical Audit

## Scope and protection

This audit describes the repository as inspected before any visual-overhaul implementation. The current branch is `main` and the worktree was clean (`git status --short --branch` showed only `## main...origin/main`; no staged, unstaged, or untracked changes). The production build completed successfully. It emitted a warning that some generated JavaScript chunks exceed 500 kB.

The only tracked project content is the Vite/TypeScript source, project configuration, README, and GitHub Pages workflow. `dist/` is generated output and is ignored by Git; there is no tracked art-asset directory.

**Branch recommendation:** start the visual work on a dedicated branch such as `visual-overhaul`, branching from the current `main` after confirming the latest baseline. Keep changes scoped to that branch and merge only after gameplay regression checks. Do not overwrite generated output as a substitute for source changes.

## Current technology stack

- TypeScript 5.7, ES modules, strict compiler settings (`tsconfig.json`).
- Vite 6 for local development and production bundling (`vite.config.ts`).
- Three.js 0.170 for WebGL rendering, scene graph, geometry, materials, lights, and cameras.
- Rapier 3D compat 0.15 for physics and character controllers.
- Browser DOM, CSS, Pointer/Keyboard events, and IndexedDB; no UI framework.
- No test or lint scripts are defined in `package.json`. `npm run build` runs `tsc -b` followed by `vite build`.

## Current rendering architecture

`src/main.ts` locates the canvas and interface mount, constructs `Game`, and displays a fatal-startup message on failure. `src/game/Game.ts` owns the renderer, shared scene-facing systems, game loop, physics world, camera, input, saves, and UI wiring.

The renderer is a `THREE.WebGLRenderer` bound to `#game-canvas`. It uses ACES filmic tone mapping, sRGB output, antialiasing, a device-pixel-ratio cap of 1.5, and soft shadows. Shadow maps are disabled for coarse-pointer devices. A single `THREE.PerspectiveCamera` is controlled by `src/player/CameraManager.ts`; it switches between first- and third-person views.

The frame loop clamps frame delta to 50 ms, updates gameplay when active, and renders the scene. Rapier is initialized before world construction and is stepped once per gameplay update. The renderer still renders the scene while the character-selection screen is shown.

## Current character and creature architecture

- `src/player/Player.ts` creates a kinematic Rapier body/capsule and a Three.js `Group`. The visible character, limbs, race details, and sword are primitive geometries and materials; movement animation is procedural limb rotation. `update`, `takeDamage`, `restore`, and `attackAnimation` are gameplay-facing methods.
- `src/player/CameraManager.ts` owns camera mode, yaw/pitch, and character facing/visibility.
- `src/creatures/Creature.ts` creates each creature's kinematic body, capsule collider, primitive model, simple leg animation, and health bar. Wolf, deer, and bear behavior/health are selected by kind.
- `src/creatures/CreatureSystem.ts` spawns a fixed group of creatures, updates companion and spirit behavior, finds tame targets, and reports rewards to `Game`.
- Combat, rewards, progression, prompts, landmarks, and interactions are coordinated by `src/game/Game.ts`. Creature meshes and the player model are not currently driven by imported skeletons or animation clips.

## Current world-generation architecture

`src/world/World.ts` creates one fixed local valley in a `THREE.Scene`: height-varied plane geometry, a circular meadow, ring-like cone mountains, a curved tube river and bank, seeded tree/grass placement, rocks, a small ruin, a cave entrance, and lighting/fog. Three.js materials and helper geometry are provided by `src/core/AssetManager.ts`.

The terrain is visually displaced, but physics uses a large flat floor collider; tree trunks and ruin pillars have additional fixed colliders. There are no generated terrain collision meshes, chunk streaming, biome system, or runtime world-seed/save support. Landmark positions and names are explicit in `World`.

## Current UI architecture

`src/ui/UI.ts` builds the main menu, race/name selection, HUD, inventory, and touch controls as DOM elements and updates them through callbacks from `Game`. `src/styles.css` provides the full-screen canvas overlay, menu, status bars, prompts, inventory, and responsive touch layout. `index.html` supplies the canvas and interface mount.

There are four race choices with distinct base attributes in `src/core/types.ts`; race selection changes character data and a few primitive appearance details, not a loaded race-specific model. The HUD and menu are not rendered in the 3D scene.

## Assets and formats

- There are **no authored model, texture, animation, audio, or font files** in the tracked repository; no `public/` or asset directory is present.
- Runtime visual assets are Three.js-generated geometry and materials in `src/core/AssetManager.ts`, `src/player/Player.ts`, `src/creatures/Creature.ts`, `src/creatures/CreatureSystem.ts`, and `src/world/World.ts`.
- Generated build bundles appear under ignored `dist/assets/`; they are not source art and should not be edited by hand.
- CSS names DM Sans and Marcellus, but the repository does not include or load those font files; the browser falls back to the remaining font stack.

## Save/load and gameplay preservation

`src/core/SaveManager.ts` stores one character in IndexedDB (`red-forgotten-valley`, object store `saves`, key `main`, schema version 1). `src/core/types.ts` defines the persisted character/race/attributes shape. `Game` loads on startup and saves at key progression events and on a timer.

The following systems are gameplay-critical and should not be replaced as part of a visual-only milestone:

- Rapier world setup, player/creature rigid bodies and colliders, character controllers, movement, and collision handling.
- `Game`'s lifecycle, update loop, input-to-action wiring, combat targeting/damage, death/respawn, rewards, progression, interactions, and autosave.
- `Player`'s gameplay API and the character attributes/data model.
- `Creature`/`CreatureSystem` AI states and callbacks for attacks, taming, companions, spirit ability, and rewards.
- `SaveManager` database identity, key, and persisted fields unless an explicit versioned migration is designed and tested.
- World landmark identities/positions and colliders that gameplay uses for collision or interaction.
- UI action callback contracts and keyboard/touch controls, even if the presentation is redesigned.

Visual models can be introduced while keeping these interfaces and gameplay owners intact. Preserve a clear separation between render transforms/animation and physics transforms.

## Performance and compatibility limitations

- The successful production build currently creates an approximately 494 kB Three.js chunk and 2,139 kB Rapier chunk (about 125 kB and 782 kB gzip respectively). Rapier is imported eagerly; split chunks do not by themselves make the engine optional or defer its download. Vite reports chunks over its 500 kB advisory threshold.
- Forest and vegetation are composed of many individual meshes; tree crowns, rocks, ground detail, creatures, terrain, and architectural pieces contribute draw calls. There is no instancing, LOD, culling strategy beyond renderer defaults, or asset streaming.
- The desktop shadow map is 2048². The pixel-ratio cap and coarse-pointer shadow disable are existing mobile safeguards, but there are no adaptive quality settings or device benchmarking.
- The visible terrain height does not match the flat ground collider, which can make characters appear to float or intersect the surface. New terrain visuals should not silently alter this physics contract; a deliberate terrain/collision milestone would be needed to fix it.
- The build target is ES2022 and the app requires WebGL, IndexedDB, and modern browser APIs. No fallback renderer or storage fallback is configured.
- The save model is one local browser save; clearing site data or changing browser/device loses access to it. Schema evolution needs care.
- GitHub Pages deployment relies on relative paths: `base: './'` in `vite.config.ts`, and `./src/main.ts` in `index.html`. New runtime asset URLs must work under the `/RED/` project subpath rather than assuming a domain-root path.
- Touch styling is selected by viewport width or coarse pointer, while some renderer quality behavior keys only off coarse pointer. Test tablet sizes and hybrid pointer devices as well as desktop and phone layouts.
- Imported humanoid/creature rigs may differ in scale, forward axis, origin, skeleton naming, and animation conventions. Asset loading and animation must not take ownership of Rapier locomotion or combat state.

## Files by major feature

| Feature | Main files |
| --- | --- |
| HTML bootstrapping | `index.html`, `src/main.ts` |
| Dependencies/build | `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts` |
| Renderer, game lifecycle, combat, gameplay orchestration | `src/game/Game.ts` |
| Shared assets/materials/procedural helpers | `src/core/AssetManager.ts` |
| Input and controls | `src/core/InputManager.ts`, `src/ui/UI.ts`, `src/styles.css` |
| Player model, physics, locomotion, damage | `src/player/Player.ts` |
| Camera | `src/player/CameraManager.ts` |
| Creature models, AI and combat | `src/creatures/Creature.ts`, `src/creatures/CreatureSystem.ts` |
| Terrain, landmarks, world geometry, lighting, static colliders | `src/world/World.ts` |
| Race and saved character data | `src/core/types.ts` |
| Local persistence | `src/core/SaveManager.ts` |
| Menu, HUD, inventory, touch layout | `src/ui/UI.ts`, `src/styles.css` |
| GitHub Pages deployment | `.github/workflows/deploy.yml`, `vite.config.ts` |
| Existing project documentation | `README.md` |

## Recommended implementation strategy

1. **Protect and baseline.** Create the dedicated branch; preserve the current clean `main` baseline. Record the current production build and verify character creation/continue, movement, both camera modes, combat, death/respawn, loot, taming, spirit, landmarks, inventory, saves, and desktop/mobile controls before visual work.
2. **Choose and inventory art.** Establish the target art direction, model/texture budgets, licensing/source, supported formats, scale/orientation conventions, and mobile/desktop targets before adding assets. None are currently supplied.
3. **Add a small asset-loading foundation.** Use Three.js's existing ecosystem and project-relative asset paths compatible with GitHub Pages. Handle loading progress and failures explicitly, and retain procedural fallbacks while validating.
4. **Build one vertical slice.** Replace only the player presentation with one appropriately licensed rigged model as a proof of asset scale, skin/material setup, and animation mapping. Keep the existing Player group, Rapier body/controller, combat API, and save data. Verify idle/move/attack presentation in both camera modes and test fallback behavior.
5. **Expand presentation incrementally.** Apply the proven approach to creatures, then landmarks/world materials and lighting, then UI polish. Preserve Creature AI and world landmark/collider semantics.
6. **Optimize and regression-test.** Measure draw calls, frame time, memory, and network payload on representative desktop and mobile devices; add instancing/LOD or quality tiers only where measurements justify them. Recheck GitHub Pages project-subpath URLs and existing gameplay/save behavior after each stage.

Avoid a renderer/framework rewrite, a world/physics rewrite, a gameplay state rewrite, or a save-schema change as part of the initial art pass.

## Recommended first implementation milestone

After approval to begin the overhaul, make the first milestone a **player-model asset-loading vertical slice** on the dedicated branch: add one licensed glTF/GLB character and load it with project-relative URLs, keep the current procedural player as an explicit fallback, and map basic idle/walk/attack presentation without changing the existing player physics/controller, gameplay API, race data, or save format. This tests the hardest integration seam with the smallest gameplay risk before investing in creature and world assets. No overhaul has been implemented in this audit.
