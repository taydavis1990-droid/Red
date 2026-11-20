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
- A safe hub and three saved floor portals. Defeating the Ancient Wolf, Eternal Phoenix, and Eternal Dragon unlocks the next floor, awards a boss reward, and returns the player to the hub.
- Boss health bars, attack telegraphs, two combat phases, and functional movement/attacks. The assigned Direwolf and Ashfen Dragon models are rigged but have no clips; the optimized Phoenix has no skeleton or clips. Their boss HUD explicitly reports the imported visual's animation state; no authored animation is implied.
- IndexedDB local saves for character progression, inventory, equipment, companions, and discovered landmarks.

Character and common wildlife visuals use source-authored procedural models. Gloom Stalker and Hollow Warden use downloaded models with embedded clips. Boss combat uses downloaded GLB visuals where available, but the Direwolf and Dragon remain in static poses and the Phoenix uses a rigid whole-model hover without wing animation. Imported boss models have not yet been visually accepted in the live game. There is no equipment management, detailed quest system, multiplayer, or finished dungeon content. The spirit ability is combat-ready but has no separate progression UI yet.

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

Saves use IndexedDB database `red-forgotten-valley`, store `saves`, and record version `2`. Version-1 character saves migrate to the Eternal Sanctuary with Floor 1 unlocked; new characters begin there as well. Keep version-specific migrations in `src/core/SaveManager.ts` when the persisted data shape changes.

## Graphics and asset foundation

The renderer automatically selects a device-aware graphics profile and offers Low, Medium, High, and Ultra quality in Settings. Runtime quality changes update render pixel ratio, shadows, shadow-map size, lighting, and texture anisotropy; antialiasing is selected at startup because WebGL context attributes cannot be changed after renderer creation. The asset manager in `src/core/AssetManager.ts` supports lazily loaded GLB/glTF models, animation clips, cached textures, and PBR base-color, normal, roughness, metallic, and ambient-occlusion maps (AO maps require UV2 coordinates). Failed model loads are reported and use the required caller-provided procedural fallback; failed material maps are reported and omitted so the base material still renders. Cached resources are shared and owned by the manager; `Game.dispose()` releases them.

Place static files in `public/assets/` and pass paths relative to that directory, such as `assets/characters/example.glb`, so they resolve beneath the GitHub Pages project path. Register each shipped asset's source, original author, license, original download URL, and file location in [public/assets/ASSET_MANIFEST.md](public/assets/ASSET_MANIFEST.md). The terrain currently uses Poly Haven's CC0 Forest Ground 04 diffuse, normal, and roughness maps. The player and common wolf/deer/bear visuals remain the existing source-authored rigs. The downloaded Direwolf, optimized Phoenix, and Ashfen Dragon are wired as local boss visuals; Gloom Stalker and Hollow Warden are regular enemies with embedded clips. These downloaded assets are not registered in the release manifest.

Use the [Blender asset pipeline](docs/ASSET_PIPELINE.md) and its inspection/export scripts for reproducible character and creature intake. User-provided assets may be used for local technical previews without making license verification a blocker. Before registering an asset for gameplay or shipping it, review its source/license, rendered appearance, rig, materials, and exported GLB.

## Local monster model preview

Start Vite from this directory with `npm run dev`, then open
`http://localhost:5173/monster-preview.html` (use the port printed by Vite if it
chooses a different one). The preview page loads the Ancient Wolf
(`marsh-direwolf.glb`), an optimized Phoenix preview derived from `phoenix.glb`,
and Ashfen Dragon (`ashfen-dragon.glb`) from
`public/assets/monsters/bosses/`.

The page reports measured bounds, applied preview scale/yaw, triangles, meshes,
skeletons, materials, texture maps, and embedded animation clips. The Phoenix
preview uses a 100k-triangle, 1024px-texture derivative; the original
`phoenix.glb` remains staged unchanged. The original and a 200k-triangle derivative
crashed the Codespaces software-rendered browser, so they are not offered in the
preview selector. The derivative retains its normal map; it has no authored tangent
attribute, so Three.js uses its fragment-derivative tangent frame. The GLB validator
warns this fallback may vary across renderers, although it rendered without browser
errors here. Drag to orbit, scroll to zoom, and use the height/yaw controls to
inspect orientation and scale. The Phoenix is static and unrigged; no animation
clips were fabricated. Combat use requires topology review, an articulated
body/wing rig and weights, and authored flight/hover/landing/attack/hit/defeat
animations. The Direwolf and Dragon are rigged but have no clips. This separate
local test page does not change the player, combat, or progression.

## Tower progression prototype

New characters start in the safe Eternal Sanctuary. Its three portals lead to the
Forsaken Wilds (initially unlocked), Ashen Sanctuary, and Dragon's Throne. Floor
access and the current location are saved with the character. Each floor has its
assigned boss encounter and a return-to-hub reward/unlock flow. The floors have
separate themed environment prototypes; Floor 2 also has the animated Hollow
Warden as a regular enemy.

The boss models do not have authored animation clips. The Direwolf and Dragon
are rigged but stay in their imported poses; the Phoenix is an optimized static
mesh with no skeleton, displayed with a rigid hover only. The HUD and monster
preview report these states honestly. The current environment has no browser
automation, so the latest in-game boss integration has not been visually
verified; open the game and `/monster-preview.html` in the Codespaces browser
before treating their appearance or scale as accepted.

## Actor models and animation

Player visuals are generated by reusable race rigs in `src/actors/CharacterRig.ts`; bone names and gameplay sockets remain stable while profiled anatomy, fitted armor, surface-specific procedural color/normal/roughness maps, and race details improve the meshes. Wolf, deer, and bear visuals use articulated quadruped rigs in `src/actors/CreatureRig.ts` with procedural idle, locomotion, attack, damage, and death poses. These are original procedural prototype models, not equivalents of Skyrim's hand-authored production assets or animation clips. Add new animation states without moving physics ownership out of `Player` or `Creature`. No third-party model licenses or external art downloads are involved.
