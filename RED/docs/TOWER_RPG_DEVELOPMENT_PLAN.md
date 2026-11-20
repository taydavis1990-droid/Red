# R.E.D. Tower RPG Development Plan

## Goal and constraints

Evolve the existing TypeScript, Three.js, Rapier, and Vite game into an original
realistic Nordic-fantasy tower RPG without restarting or replacing its working
systems. Keep the existing player controller, Rapier capsule, camera modes, combat
callbacks, saves, inventory, and companion behavior. Do not use the low-poly
Fantasy kit in the finished game. Do not claim a static-pose model has authored
animation; a boss may use that model as a clearly disclosed static visual while
its separate AI/combat remains functional. Do not change the active player model
until a rendered preview has been shown to the user and explicitly approved.

The approved visual direction is realistic, weathered Nordic fantasy. "Skyrim-style"
is a visual reference only; use original designs.

This plan is informed by the current project and
[asset inventory](../../ASSET_INVENTORY.md). This document does not grant asset
rights or approve player replacement. Local copies and gameplay integration
completed so far are recorded in the implementation status below.

## Pre-implementation baseline

- `Game` owns one `World`, one player, and one `CreatureSystem`; it has no tower,
  floor transition, boss, or floor-unlock state.
- `World` represents the single Forgotten Valley. `CreatureSystem` spawns wolves,
  deer, and bears directly.
- The player has a Rapier kinematic capsule, first-/third-person cameras, movement,
  sprint, jump, block, sword attacks, damage, death/respawn, and persistence.
  Combat and physics are separate from the character visual rig; preserve that.
- Player GLB loading exists behind `PLAYER_CHARACTER_ASSETS`. Validation requires
  reviewed provenance/license, a model at most 20 MiB and 80,000 faces, textures at
  most 2048 px, and a usable skeleton. The asset manifest and Blender intake guide
  also require source/license and visual/rig review for release.
- `Creature` used procedural visuals and owns the collider/AI. The reusable GLB
  preview/rig adapter was added separately; imported visuals must not own or
  replace those gameplay systems.
- Existing terrain uses one 1K texture set. The downloaded archives do not contain
  a complete realistic three-floor environment set.

## Implementation status (2026-11-20)

- Added version-2 character records and a version-1 migration that preserves
  existing character data and places legacy saves in the Eternal Sanctuary. New
  characters also start in the hub. Floor portals are gated by saved unlock state;
  transitions dispose the old environment while retaining the existing player
  controller and combat systems.
- Added distinct hub, volcanic, and fortress environment prototypes. Floor 1
  remains the existing valley. The Ancient Wolf, Eternal Phoenix, and Eternal
  Dragon now have two-phase boss encounters with telegraphs, health bars, rewards,
  save-backed floor unlocks, and return-to-hub flow. Their imported visuals use
  the assigned Direwolf GLB, optimized 99,996-triangle Phoenix derivative, and
  Ashfen Dragon GLB respectively. Existing collider/AI ownership remains in
  `Creature`; imported visual roots do not replace the Rapier bodies.
- Staged local copies of the Gloom Stalker and Hollow Warden and connected them to
  the existing `Creature` physics/AI owner. Their exact embedded clips are mapped
  to idle, locomotion, attack, and hit states. Gloom Stalker has a `death_fall`
  clip; Hollow Warden only has `knocked_down`/`get_up`, so its terminal pose is a
  mapped knockdown, not an authored death clip.
- The three imported boss models have no usable authored animation: Direwolf and
  Dragon are rigged with no clips; Phoenix is static and unrigged. The Phoenix
  uses rigid whole-model hover only, with no wing motion. The in-game boss HUD
  discloses each model's actual animation state. Skeleton visualization is
  disabled for models with no skeleton. This is a functional combat prototype,
  not final visual or animation acceptance.
- The latest boss integration has not been visually verified in a browser.
  Browser automation and Blender are unavailable in the current environment.
  Player model replacement remains gated on a rendered comparison and explicit
  approval; no player model change is included here.

## Asset integration direction

Treat the downloaded models as user-provided assets available for this project's
local planning and technical testing. Missing source/license data is **not** a
blocker for local model loading, rig inspection, prototype animation, or performance
tests. Keep any unknown provenance accurately marked as unknown; do not invent
credits. Before a future release/distribution, record and review provenance and
license separately. Source archives and loose originals remain unchanged.

The existing player importer has a release-oriented validator that requires asset
review and enforces size, face, and texture budgets. During implementation, add a
clearly separated local-test/preview path for these user-provided assets rather
than inserting false review metadata or silently weakening release checks. Keep
local-test assets out of the release manifest until that separate review is done.

The full ZIP/file inventory, measurements, and format notes are in the
[asset inventory](../../ASSET_INVENTORY.md). The required monster assignments and
their actual geometry/rig/clip status are:

| Priority / role | Asset | Actual state | Work required before combat use |
| --- | --- | --- | --- |
| Floor 1 boss: Ancient Wolf | `hollowreach/creatures/marsh-direwolf.glb` | Skinned/rigged; 31 joints, about 39,798 triangles, 3 x 1024 maps, 5.33 MB; **no clips**. | Inspect skeleton, skin weights, pose, axes, and scale. Author or retarget canine idle, walk, run, turn, attack, hit, and death clips. Build the Ancient Wolf boss phases on top of existing creature AI/physics ownership. |
| Floor 2 boss: Eternal Phoenix | `phoenix.glb` | **Static** mesh; no skeleton or clips, 800,000 triangles, 3 x 4096 maps, about 28.66 MB. | Highest-risk art task. Inspect topology and mesh parts; optimize/retopologize, create wing/body/head rig and weights, author flight/hover/land/attack/hit/death clips, and reduce/rebake textures. A rigid whole-mesh transform is not a combat animation. |
| Floor 3 boss: Eternal Dragon | `hollowreach/creatures/ashfen-dragon.glb` | Skinned/rigged; 39 joints, about 39,634 triangles, 3 x 1024 maps, 5.62 MB; **no clips**. | Inspect whether the rig supports wings, legs, neck, and tail deformation. Author or retarget grounded/flying locomotion, turns, breath/strike attacks, hit, and death clips; build distinct boss phases. |
| Regular humanoid enemy | `hollowreach/creatures/gloom-stalker.glb` | Skinned/rigged and animated; 28 joints, about 39,957 triangles, 3 x 1024 maps, 5.51 MB, 12 clips. | First regular-enemy animation integration candidate. Verify clip binding and deformation, then map exact clips to idle, locomotion, attacks, dodge, hit, and death. Add AI/attacks separately from the visual rig. |
| Regular serpent enemy | `hollowreach/creatures/marsh-python.glb` | Skinned/rigged; 21 joints, about 39,937 triangles; **no clips**. | Inspect the spine hierarchy and weights; author slither, turn, strike, hit, and death animation. |
| Regular wyrm enemy | `hollowreach/creatures/hollow-wyrm.glb` | Skinned/rigged; 48 joints, about 39,896 triangles; **no clips**. | Inspect intended locomotion and skeleton; author locomotion, turn, attack, hit, and death clips. Do not assume it shares the Dragon rig. |
| Additional humanoid foe | `hollowreach/characters/hollow-warden.glb` | Skinned/rigged and animated; 52 joints, about 39,251 triangles, 3 x 1024 maps, 6.40 MB, 15 clips. | Reuse as an enemy only after validating clips/rig; its sword, shield, parry, knockdown, and get-up clips are useful for a melee foe. |
| Alternate wolf visual | `wolf.glb` | **Static** mesh; no skeleton or clips, 448,652 triangles, 3 x 4096 maps, about 20.39 MB. | Compare visually with the Direwolf in a preview only. To become combat-ready, it needs topology/texture optimization and a new skeleton, weights, and canine clips. Do not substitute it as an animated wolf before that work. |
| Alternate dragon visual/display | `crystal-dragon.glb` | **Static** mesh; no skeleton or clips, 799,999 triangles, 3 x 4096 maps, about 31.04 MB. | Optional visual comparison or static display only. Combat use requires major optimization plus a new rig, weights, and dragon clips. It does not replace the Ashfen Dragon assignment. |
| Unclassified creature-like asset | `under.glb` | Skinned/rigged; 24 joints, about 46,625 triangles, 3 x 2048 maps, one generic clip named `Armature\|clip0\|baselayer`. | Identify the model and inspect its skeleton/clip in a viewer before assigning any role. The filename and generic clip do not establish that it is an enemy or has usable locomotion. |
| Existing creatures | Procedural wolf, deer, bear | Existing gameplay/visual rigs and AI; no downloaded model replacement planned for deer or bear in this slice. | Preserve as fallback and existing wildlife until separately reviewed/downloaded candidates are selected. |

Rigged means a skin/skeleton is present; it does **not** mean the asset includes
animation. Animated means clips are embedded; it does not prove they deform
correctly or suit the game's states. The priority bosses remain the three listed
above; do not silently substitute the static loose Wolf or Crystal Dragon. The
Dark Dungeon models are static environment props, not enemy characters. The
low-poly Fantasy archive is excluded from the game's finished visuals.

### Player visual-preview gate

The existing player character remains active and unchanged throughout monster
integration. Before any player replacement, create a preview-only comparison of
the candidate GLBs using their actual rendered models, with front/back/side and
close-up material views. Do not add a candidate to `PLAYER_CHARACTER_ASSETS` or
make it the active player before showing that preview and receiving explicit user
approval. The `vale-reference.png` image is only a reference and does not satisfy
this gate.

For technical comparison only: `ashfen-ranger.glb` is about 5.67 MB, 39,003
triangles, 34 bones, and has five locomotion/turn clips; `hollow-warden.glb` is
about 6.40 MB, 39,251 triangles, 52 bones, and has 15 clips; `vale-shieldmaiden.glb`
is about 17.30 MB, 98,258 triangles, 52 bones, and has 15 clips. The Vale model
exceeds the current 80,000-face validator threshold as supplied. These measurements
rank technical tradeoffs, not visual quality.

## Target game structure

1. **The Eternal Sanctuary**: safe, non-combat hub, player spawn/return point,
   portal selection, NPC/merchant access, equipment displays, floor/boss status,
   and next-floor access only after the prior boss is defeated.
2. **Floor 1 - Forsaken Wilds**: snowy Nordic forest, ancient ruins, cave and
   abandoned-camp spaces, culminating in the Ancient Wolf.
3. **Floor 2 - Ashen Sanctuary**: volcanic temple, black stone, ash and fire, with
   the Eternal Phoenix as the boss.
4. **Floor 3 - Dragon's Throne**: mountain fortress, bridges and storm atmosphere,
   dragon architecture and treasure, culminating in the Eternal Dragon.

The Dark Dungeon Props package contains static dressing props, not a complete
environment kit; its inspected previews are stylized, so use a prop in the finished
game only if it passes the realistic visual target. The low-poly Fantasy kit is
explicitly excluded. Use the user-provided monster models for local technical
testing as directed. Source or author realistic architecture and environment art
separately; do not treat unrelated stylized props as a substitute for a complete
Nordic, volcanic, or mountain-fortress environment.

## Implementation sequence

### Phase 0 - Baseline and local asset test setup

- Preserve the current valley milestone and capture a baseline build and gameplay
  checklist before starting.
- Local test copies of the priority bosses, optimized Phoenix, Gloom Stalker, and
  Hollow Warden are staged beneath `RED/public/assets/monsters/`. Source archives
  and workspace-root originals were not changed.
- Add a local-test path that can load user-provided GLBs with unknown provenance
  without fake review metadata. Keep it separate from the existing release
  validator and manifest; missing license information must not block local
  technical tests.
- Open/render the actual candidate GLBs in a viewer. Inspect front, sides, back,
  close-up materials, scale, axes, rest pose, skeleton hierarchy, weights, and
  animation deformation. PNG reference art does not prove the GLBs look the same.
- Record file size, triangles, bones, texture dimensions, exact clip names, and
  visual/technical findings. Track provenance when available as separate release
  metadata; it is not an entry criterion for this local prototype work.

**Exit:** existing game baseline and local model inspection are recorded; no
downloaded asset has replaced the player.

### Phase 1 - Tower progression and save compatibility

- Add a typed floor/progression record: current location, unlocked floors, and
  defeated boss IDs. Migrate existing version-1 IndexedDB saves without losing
  characters, stats, inventory, equipment, companions, or landmarks; increment the
  save schema version and test old-save migration.
- Add explicit hub, floor-entry, boss-defeat, and return-to-hub transitions. Floor
  transitions must dispose old scene resources and Rapier colliders, then restore
  the player at the correct spawn. The hub must not spawn hostile wildlife.
- Make floor unlocks depend on durable boss-defeat state, not proximity or UI
  visibility. Autosave after boss defeat and successful transitions.
- Keep the existing combat input and player physics intact; add transitions as
  state changes around the existing world/game loop, not a new game instance that
  resets progression.

**Exit:** a migrated existing save reaches the hub; floor 1 can be entered and
exited; locked floors cannot be entered; restart/continue preserves progress.

### Phase 2 - Boss combat framework and creature visual adapter

- Introduce a boss combat interface compatible with the current attack, damage,
  reward, and update paths. Keep the boss collider separate from its visual model.
- Add dodge as a player action with stamina/cooldown and invulnerability timing
  only if the existing controller and combat tests remain stable.
- Implement boss health presentation, telegraphed attacks, damage reactions,
  defeat/reward callbacks, and distinct phases driven by health thresholds.
- Implement a `Creature`/boss visual adapter around `GLTFLoader` and
  `AnimationMixer`; keep `Creature` AI, Rapier body/collider, attack range, damage,
  tamed state, and reward callbacks in their existing gameplay owners.
- Support exact clip mapping, scale/orientation/ground offsets, cleanup, explicit
  load errors, and procedural fallback. A missing clip must not be silently
  presented as an animated state.
- Keep mobile and keyboard controls and ensure boss HUD works with existing UI.

**Exit:** local test loading works without changing the player configuration, and
automated/gameplay tests still demonstrate attack, block, damage, death, and
collisions with the player's Rapier capsule ownership unchanged.

### Phase 3 - Floor 1 boss: Ancient Wolf

- Use `hollowreach/creatures/marsh-direwolf.glb` as the primary model, as assigned.
  It is rigged but has no embedded animation clips.
- Inspect all 31 joints, skin weights, rest pose, and mesh axis/origin. Create
  canine idle, walk, run, turn, attack, hit, and death clips on this rig or retarget
  suitable clips after confirming compatible skeleton mapping.
- Build Ancient Wolf health/phases/telegraphs and boss rewards around the existing
  collision and combat systems. Keep the existing procedural wolf as a fallback.
- Compare loose `wolf.glb` in a visual preview only; its static 448k-triangle mesh
  is not an animation-ready substitute.

**Exit:** Ancient Wolf visibly uses the Direwolf model in the game and has working
locomotion, attack, hit, death, boss phases, collision, defeat, save, return, and
floor unlock behavior.

### Phase 4 - Floor 2 boss: Eternal Phoenix

- Use `phoenix.glb` as the required visual source; it is static, has no skeleton,
  has 800k triangles, and uses three 4K images.
- Inspect whether existing mesh parts can be rigged. If not, separate/rebuild the
  wing, body, neck, and tail topology; create a deforming skeleton and skin weights.
  Optimize geometry and rebake texture maps before loading it in the runtime.
- Author visibly articulated takeoff/flight/hover/landing, attack, hit, and death
  motion. Do not implement the boss as only a floating/rotating rigid mesh.
- Add the Phoenix phases, arena telegraphs, health presentation, and defeat reward
  to the boss framework.

**Exit:** Phoenix appears as the assigned model, has independently moving wings
and tested boss animations, and meets the profiled runtime budget. If rigging or
animation cannot be completed, mark this boss blocked rather than substituting a
static boss.

### Phase 5 - Floor 3 boss: Eternal Dragon

- Use `hollowreach/creatures/ashfen-dragon.glb` as the primary model, as assigned.
  It is rigged (39 joints) but has no animation clips.
- Inspect the skeleton and weights for wings, legs, neck, and tail. Author or
  retarget compatible grounded/flying locomotion, turns, breath/strike attacks,
  hit, and death clips.
- Implement its distinct boss phases and arena behavior; retain the same player
  combat, damage callback, collision, reward, save, and return contracts.
- Inspect `crystal-dragon.glb` only as an alternate visual/static-display source;
  it is static and extremely dense, so it does not replace the Ashfen Dragon.

**Exit:** Ashfen Dragon has verified articulated animation, distinct boss phases,
and a complete defeat/return/unlock flow.

### Phase 6 - Regular enemies

- Integrate `gloom-stalker.glb` first because it already has a rig and 12 reported
  clips. Verify the exact clip names in the loaded GLB and map only present clips
  to idle, walk/run, turns, attacks, hit, and death.
- Add `hollow-warden.glb` as a melee humanoid enemy after validating its 15 clips
  and gameplay scale. Keep it an enemy; it is not an approved player replacement.
- Add `hollow-wyrm.glb` and `marsh-python.glb` only after authoring species-specific
  animation for their rigs, which currently have no embedded clips.
- Keep static `wolf.glb` and `crystal-dragon.glb` out of combat unless fully
  optimized, rigged, and animated. Do not treat static props or concept images as
  enemy models.

**Exit:** each enabled enemy has the required idle/locomotion/attack/hit/death
states, AI, collision, damage, and cleanup tested independently.

### Phase 7 - Player visual preview (no replacement yet)

- Build a preview-only comparison for the player candidates using their actual
  rendered GLBs. Show front/back/side/close-up materials and check scale and rig.
- Do not update `PLAYER_CHARACTER_ASSETS`, change the selected player model, or
  remove the current procedural player until the preview has been shown and the
  user explicitly approves a candidate.
- If approval is later given, map only verified clips and keep the current player
  physics, camera, attack socket, first-person weapon, and procedural fallback.

**Exit:** user has seen the actual model preview; absent explicit approval, current
player visuals remain active.

### Phase 8 - Environments, progression finish, and verification

- Build the hub and floors as separately loaded scenes with tested collision,
  spawn points, traversal, and distinct lighting/weather profiles.
- Floor 1: snowfall, cold fog, snow-ready terrain materials, Nordic ruins, camps,
  and Ancient Wolf arena.
- Floor 2: black stone, lava/light sources, ash/smoke, volcanic materials, and
  Eternal Phoenix arena.
- Floor 3: mountain silhouette, fortress/bridge traversal, storm effects, dragon
  architecture and treasure, with the Eternal Dragon.
- Build The Eternal Sanctuary as a protected return state with portal selection,
  NPC/merchant access, equipment displays, floor/boss status, and progression.
- Use realistic environment assets or authored sets. Exclude the low-poly Fantasy
  kit, and use Dark Dungeon props in the finished world only if they visually fit.
- Verify each boss defeat is saved, returns the player to the hub, and unlocks only
  the next floor.

**Exit:** hub and three floors are traversable; all bosses are animated and have
phases; progression order persists after reload.

### Phase 9 - Optimization and final verification

- Profile draw calls, triangles, texture memory, load times, and frame rate on a
  representative desktop and mobile device. Use LODs, texture reduction, and
  instancing only after visual comparisons.
- Verify GLB base color, normal, roughness, and metallic maps are color-space
  correct. Add AO only when UV2 exists. Check console and network failures.
- Test clean start, old-save migration, new save, reload, floor locks, boss defeat,
  hub return, inventory/equipment panels, combat controls, collisions, and cleanup.
- Run `npm run build`, focused tests, and `git diff --check`. Then verify the game
  in a real browser at the Vite URL and inspect actual rendered models and console
  output. A build or HTTP 200 alone is not visual verification.
- Before any player replacement, present the in-game visual preview and wait for
  explicit user approval. No such replacement is authorized by this plan.

## Acceptance criteria

- Existing character creation, movement, camera, attack/block, wolf taming,
  companion, inventory, and saves still work.
- Hub is safe; floors unlock in order only through boss defeat and remain unlocked
  after reload.
- Each boss has a visible health bar, telegraphed attacks, reactions, multiple
  behavior phases, and an actual defeat/return/unlock path.
- No static mesh is described or presented as a fully animated combat creature.
- Local technical testing does not wait on license verification. Any future
  distribution review is tracked separately. The finished environments/actors do
  not use visibly low-poly kit assets.
- Actual-game visual review confirms model scale, materials, movement, and
  animations; runtime and build checks pass without missing assets or regressions.
