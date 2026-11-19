# RED — Realm of Eternal Dragons

**The Forgotten Valley** is the first playable milestone: a procedural, single-player 3D fantasy exploration prototype built with TypeScript, Three.js, Vite, and Rapier 3D.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Production output is generated in `dist`:

```sh
npm run build
npm run preview
```

## Controls

### Keyboard and mouse

- **WASD** — move; **hold and drag the mouse** — look around
- **Shift** — sprint; **Space** — jump; **B** — block
- **Click** — sword attack; **E** — interact/tame a weakened wolf
- **V** — switch first-/third-person camera
- **Q** — summon or dismiss Spirit of the Wolf
- **I** — inventory

### Touch screens

Use the on-screen joystick and action buttons. Drag anywhere outside the controls to look around. The camera, jump, block, attack, interact, spirit, and sprint actions are available from the touch HUD.

## What is playable

- A locally generated, seeded wilderness with rolling, collision-matched hills, blended procedural ground textures, winding footpaths, clustered instanced forests, a river, Elderwatch Ruins, Mossfall Cave, and the abandoned Ashen Camp.
- Wind-swaying trees and ground cover, distant atmospheric fog, soft particles, daylight color shifts, and generated ambient wind and bird calls.
- Third- and first-person cameras driving the same Rapier character controller.
- A visible first-person sword and armored arm, with a shaped steel blade, detailed hilt, and animated idle/attack motion.
- Four starting races with distinct base attributes.
- Wolves that pursue and attack, deer that flee, and territorial bears that telegraph attacks.
- A timed three-hit sword combo with visible hit feedback and knockback, alongside blocking, health/death/respawn, creature loot, XP, levels, a basic inventory, wolf taming/following, and a timed spectral wolf ability.
- IndexedDB local saves for character progression, inventory, equipment, companions, and discovered landmarks.

Character and creature visuals use stylized, source-authored procedural models and animation rather than imported production assets or animation clips. There is no equipment management, detailed quest system, multiplayer, boss encounters, boss AI, boss arenas, or full RPG content set in this milestone. The spirit ability is combat-ready but has no separate progression UI yet. The cave is an explorable landmark entrance, not a finished dungeon.

## GitHub Pages

The Vite `base: './'` setting makes generated asset URLs relative, including under this project's Pages path: `https://taydavis1990-droid.github.io/Red/`. The repository-root workflow at `.github/workflows/deploy-pages.yml` builds this app from `RED/` and deploys it to GitHub Pages on pushes to `main`.

## Architecture

```text
src/
  core/       input, procedural assets, save storage, shared game types
  creatures/  creature models, AI, combat and companion/spirit behavior
  game/       application setup and game loop
  player/     player controller and switchable camera
  ui/         character selection, HUD, inventory, touch controls
  world/      procedural Forgotten Valley terrain, instanced scenery, atmosphere, and physics
```

Saves use IndexedDB database `red-forgotten-valley`, store `saves`, and version `1`. Keep version-specific migrations in `src/core/SaveManager.ts` when the persisted data shape changes.

## Graphics and asset foundation

The renderer automatically selects a device-aware graphics profile and offers Low, Medium, High, and Ultra quality in Settings. Runtime quality changes update render pixel ratio, shadows, shadow-map size, lighting, and texture anisotropy; antialiasing is selected at startup because WebGL context attributes cannot be changed after renderer creation. The asset manager in `src/core/AssetManager.ts` supports lazily loaded GLB/glTF models, animation clips, cached textures, and PBR base-color, normal, roughness, metallic, and ambient-occlusion maps (AO maps require UV2 coordinates). Failed model loads are reported and use the required caller-provided procedural fallback; failed material maps are reported and omitted so the base material still renders. Cached resources are shared and owned by the manager; `Game.dispose()` releases them.

Place future static files in `public/assets/` and pass paths relative to that directory, such as `assets/characters/example.glb`, so they resolve beneath the GitHub Pages project path. Register each shipped asset's source, original author, license, original download URL, and file location in [public/assets/ASSET_MANIFEST.md](public/assets/ASSET_MANIFEST.md). The terrain currently uses Poly Haven's CC0 Forest Ground 04 diffuse, normal, and roughness maps; no imported character or creature models are included, and actor visuals remain original source-authored procedural rigs.

Use the [Blender asset pipeline](docs/ASSET_PIPELINE.md) and its inspection/export scripts for reproducible character and creature intake. Imported actors remain unregistered until their source license, rendered appearance, rig, materials, and exported GLB have all passed review.

## Actor models and animation

Player visuals are generated by the reusable race rigs in `src/actors/CharacterRig.ts`; humanoid joint bones have stable names for clip-compatible animation, and race-specific proportions, faces, equipment, and attachments are kept separate from the player's Rapier capsule and gameplay data. Wolf, deer, and bear visuals use quadruped rigs in `src/actors/CreatureRig.ts` with idle, locomotion, attack, damage, and death poses. The original visual direction uses compact toon-shaded forms and a cinematic fantasy palette to keep the rendering affordable on mobile. These procedural models are still prototype art rather than production-quality authored assets. Add new animation states to these visual rigs without moving physics ownership out of `Player` or `Creature`. No third-party model licenses or external art downloads are involved.
