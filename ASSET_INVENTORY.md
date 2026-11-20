# R.E.D. Asset Inventory and Proposed Use

## Scope and method

Searched `/workspaces` for ZIP and common 3D asset formats. Inspected ZIP central
directories and embedded README/license/JSON metadata without unpacking over the
archives. Read GLB headers and embedded JSON, measured accessor triangle counts,
and checked embedded image dimensions. A few dark-dungeon preview PNGs were read
to `/tmp` for visual screening; originals were not changed.

This inventory records candidate files and their inspected metadata. After the
inventory was approved for local technical testing, copies of the Marsh Direwolf,
Phoenix, Ashfen Dragon, and a Phoenix optimization derivative were staged under
`RED/public/assets/monsters/bosses/` and wired as local boss visuals. Gloom
Stalker and Hollow Warden copies are under `RED/public/assets/monsters/enemies/`
and are wired as local game enemies. These unreviewed copies are not in the
release manifest. The Phoenix derivative is displayed in a static pose; the
Direwolf and Dragon are rigged but have no clips. Source archives and loose
originals remain unchanged. Geometry and metadata inspection is not a substitute
for in-game visual testing.

## Summary

| Workspace file | Size | Inventory result |
| --- | ---: | --- |
| `crimson-obsidian-sentinel (1).zip` | 1,391,667,200 bytes | Malformed/incomplete ZIP; streaming tools recover 137 names (68 GLB, 68 FBX, and one nested ZIP), but report every member as zero bytes. There are only 34 distinct model stems, each repeated. No license/readme is present in the recoverable listing. Do not use this copy. |
| `dark-dungeon-props-v1.2.0.zip` | 1,231,494,580 bytes | Valid ZIP; 34 unique static prop models in GLB and FBX, 170 2K PBR PNG maps, 34 720px asset previews, six collection preview images, and per-asset JSON metadata. CC BY 4.0 with required attribution. |
| `fantasy.zip` | 2,364,619 bytes | Valid ZIP; 31 low-poly GLBs plus README and license. No embedded image textures or animations. Shuriken Studio custom license permits project use, including commercial, but prohibits redistributing the models as a library/pack. |
| `hollowreach-pack.zip` | 143,197,684 bytes | Valid ZIP; 18 GLBs, 24 PNGs, and 14 audio files. Has useful rigged characters/creatures, but no license, README, creator, or source evidence was found. User-provided copies may be used for local technical testing; distribution requires separate provenance/license review. |
| `crystal-dragon.glb` | 31,036,920 bytes | Loose workspace GLB; static, 799,999 triangles, three 4K JPEG PBR images; no license/provenance found. |
| `medieval-villager.glb` | 23,908,392 bytes | Loose workspace GLB; static, 647,846 triangles, three 4K JPEG PBR images; no license/provenance found. |
| `phoenix.glb` | 28,655,980 bytes | Loose workspace GLB; static, 800,000 triangles, three 4K JPEG PBR images; no license/provenance found. |
| `under.glb` | 7,636,176 bytes | Loose workspace GLB; one 24-joint skin and one generically named animation, 46,625 triangles, three 2K JPEG images; root scale is 0.01; no license/provenance found. |
| `wolf.glb` | 20,393,412 bytes | Loose workspace GLB; static, 448,652 triangles, three 4K JPEG PBR images; no license/provenance found. |

No loose `.gltf`, `.fbx`, `.obj`, `.mtl`, or `.blend` files were found. No OBJ
files occur in the valid ZIP inventories. `RED/public/assets/monsters/bosses/`
contains preview copies of the assigned Marsh Direwolf, Phoenix, and Ashfen
Dragon, plus the Phoenix derivative. `RED/public/assets/monsters/enemies/`
contains the staged Gloom Stalker and Hollow Warden GLBs, currently integrated
with their embedded animation clips. These are local test copies and are not
registered for release.

## ZIP: `dark-dungeon-props-v1.2.0.zip`

The archive README describes 34 static props, self-contained GLBs, FBX alternatives
with adjacent textures, applied transforms, meters, and bottom-center ground
pivots. Each prop has one material and metadata with triangle count and dimensions
(longest side normalized to about one meter). The 34 assets total 171,590 triangles;
per-asset counts range from 1,769 to 12,883. The PNG set contains five 2048x2048
maps per model (`basecolor`, `emissive`, `metallic`, `normal`, `roughness`), plus
preview images. The README says GLB resources are embedded.

License text: CC BY 4.0. Required credit: **“Dark Dungeon Props by Sotudios.
Models created with Meshy.”** Preserve the license link and indicate modifications.
The third-party notice says the source prompts and reference inputs remain the
source creator's responsibility. The reviewed example previews look like stylized,
AI-assisted dark-fantasy props. Use them as secondary set dressing, not as a
replacement for a coherent hero environment or animated actor. The metadata
dimensions are normalized props, not evidence that a named “citadel” is a
walkable, full-scale building.

For each row, the GLB path is
`dark-dungeon-props-v1.2.0/models/glb/<collection>/<stem>.glb`; the FBX path is
`dark-dungeon-props-v1.2.0/models/fbx/<collection>/<stem>/<stem>.fbx`. Each has
`<stem>_{basecolor,emissive,metallic,normal,roughness}.png` FBX texture maps and
an asset preview under `previews/assets/<collection>/<stem>.png`.

| Asset filename stem | Intended R.E.D. use | Triangles; dimensions (m) | Compatibility / licensing notes |
| --- | --- | --- | --- |
| `barbed-entanglement` | Floor 2/3 corrupted growth, hazard dressing | 4,759; 1.000 x 0.668 x 0.607 | Static prop; CC BY 4.0 attribution. |
| `crown-of-emerald-sludge` | Corrupted shrine or loot prop, Floor 2/3 | 3,247; 1.000 x 0.996 x 0.499 | Static; title does not make it an enemy or wearable item. |
| `nethergate-ruins` | Ruined gateway dressing, Floor 1 or 3 | 4,776; 1.000 x 0.676 x 0.645 | Static; good thematic prop, not a complete ruin environment. |
| `spiral-stone-dragon` | Dragon-fortress sculpture, Floor 3 | 3,791; 0.785 x 0.818 x 1.000 | Static stone decoration, not a dragon enemy. |
| `tendrils-of-the-crack` | Volcanic fissure/ground dressing, Floor 2 | 2,568; 1.000 x 0.996 x 0.459 | Static; CC BY 4.0 attribution. |
| `bloodstained-stool` | Interior prop / crypt dressing | 2,757; 0.957 x 1.000 x 0.740 | Static; niche utility. |
| `eyebound-totem` | Cryptid shrine or enemy-lair dressing | 4,051; 0.649 x 0.311 x 1.000 | Static totem, not an animated enemy. |
| `ironbound-timber-panel` | Floor 1 timber/Nordic ruin detail | 3,142; 0.996 x 0.145 x 1.000 | Static panel; useful as detail, not structural wall kit. |
| `tangle-of-antlers` | Snowy forest / hunting-lair dressing, Floor 1 | 5,014; 1.000 x 0.980 x 0.609 | Static antler pile, not wildlife. |
| `cracked-gold-chalice` | Central-hub relic or dungeon loot | 3,024; 0.941 x 0.738 x 1.000 | Static prop. |
| `crumbling-stone-wings` | Ruined monument detail, Floor 1/3 | 5,341; 1.000 x 0.692 x 0.702 | Static; not a full ruin set. |
| `cursed-codex` | Hub/library or dungeon loot prop | 5,635; 0.922 x 0.926 x 1.000 | Static book, not a journal UI asset. |
| `embervault-reliquary` | Volcanic dungeon relic, Floor 2 | 8,051; 1.000 x 0.953 x 0.582 | Static prop. |
| `gilded-cracked-sphere` | Arcane/phoenix-arena focal prop, Floor 2 | 9,574; 0.812 x 0.798 x 1.000 | Static; no interaction or animation. |
| `twin-rings-of-thorns` | Ritual/arena detail, Floor 2/3 | 3,427; 1.000 x 0.988 x 0.573 | Static decoration. |
| `emberbound-cauldron` | Volcanic dungeon prop, Floor 2 | 3,862; 1.000 x 1.000 x 0.584 | Static; strongest direct inferno-prop fit. |
| `embercrystal-citadel` | Volcanic arena decoration, Floor 2 | 2,983; 1.000 x 1.000 x 0.785 | Despite its name, metadata dimensions indicate a roughly 1 m prop, not a fortress. |
| `molten-obsidian-bastion` | Volcanic arena/fortress accent, Floor 2 | 4,858; 1.000 x 0.998 x 0.552 | Static small prop; not a walkable bastion. |
| `obsidian-ember-circle` | Phoenix arena altar/arena marker, Floor 2 | 1,769; 1.000 x 1.000 x 0.209 | Static, low profile; plausible arena dressing. |
| `coalbound-remains` | Battlefield/cave remains, Floor 2/3 | 3,164; 1.000 x 0.994 x 0.271 | Static remains, not a combatant. |
| `dismantled-expedition` | Floor 1 ruin/camp storytelling prop | 12,883; 0.998 x 1.000 x 0.303 | Static; highest polygon count in this pack. |
| `mountain-of-bones` | Boss-lair/battlefield dressing, Floor 2/3 | 5,651; 1.000 x 1.000 x 0.405 | Static bone pile, not an enemy. |
| `shattered-knight` | Fallen knight corpse / Floor 3 narrative prop | 8,108; 1.000 x 0.982 x 0.339 | Preview depicts a prone body; static, not usable as an animated character or armor set. |
| `cracked-runic-circle` | Hub or boss-arena floor motif | 6,644; 1.000 x 0.998 x 0.171 | Static floor prop. |
| `crimson-obsidian-sentinel` | Central hub / boss arena obelisk | 6,974; 0.481 x 0.520 x 1.000 | Static pillar/totem in preview; not an enemy despite “sentinel” name. |
| `crimson-runed-circle` | Phoenix/boss arena marker, Floor 2/3 | 2,725; 1.000 x 0.998 x 0.111 | Static floor prop. |
| `elemental-runic-circle` | Hub magic/portal motif | 2,605; 0.965 x 1.000 x 0.093 | Static floor prop. |
| `emberstone-throne` | Central tower hub focal furniture | 8,182; 0.552 x 0.543 x 1.000 | Static; useful interior prop, not a tower. |
| `necropolis-circle` | Floor 3 boss arena / necropolis marker | 2,995; 1.000 x 1.000 x 0.143 | Static floor prop. |
| `radiant-obelisk` | Hub landmark / arena marker | 7,193; 0.441 x 0.458 x 1.000 | Static obelisk. |
| `runic-ember-circle` | Floor 2 ritual/phoenix arena | 4,423; 1.000 x 0.994 x 0.084 | Static floor prop. |
| `skullbound-obelisk` | Floor 3 boss-lair marker | 6,806; 0.523 x 0.528 x 1.000 | Static obelisk. |
| `verdant-runic-circle` | Central hub/portal floor motif | 2,592; 1.000 x 0.994 x 0.113 | Static floor prop; palette may conflict with volcanic themes. |
| `verdant-spiral-obelisk` | Floor 1/hub arcane landmark | 8,016; 0.486 x 0.519 x 1.000 | Static obelisk; palette fit should be checked. |

## ZIP: `fantasy.zip`

`fantasy/README.txt` identifies this as Shuriken Studio's free, stylized low-poly
Fantasy kit. All 31 GLBs are static, with no skins, animations, or embedded image
textures; measured models range from 1,136 to 14,788 triangles. The LICENSE permits
use in projects (including commercial projects) without credit, but forbids
redistributing the models alone or as an asset library/pack. It references the
online terms in force at download; retain this license text and confirm the current
terms before release. This is the most convenient licensed GLB kit for immediate
prop prototyping, but its explicit low-poly Roblox-kit aesthetic will not match the
current Skyrim-inspired environment without a deliberate style decision.

| Asset filename | Suggested use | Triangles | Compatibility / licensing |
| --- | --- | ---: | --- |
| `fantasy/leaning-wizard-tower.glb` | Hub tower landmark | 6,242 | Static low-poly tower; best named tower candidate, but not Nordic/realistic. |
| `fantasy/elven-treehouse.glb` | Floor 1 forest landmark | 8,068 | Static, stylized. |
| `fantasy/floating-sky-island.glb` | Hub vista/sky landmark | 6,276 | Static; floating-island theme may not fit. |
| `fantasy/dragon-treasure-hoard.glb` | Floor 3 hoard room | 5,678 | Static hoard prop, not a dragon. |
| `fantasy/fairy-mushroom-house.glb` | Optional forest dressing | 3,514 | Stylized/fairy aesthetic likely mismatches Nordic forest. |
| `fantasy/dragon-statue-fountain.glb` | Floor 3 dragon-fortress decoration | 5,492 | Static statue/fountain, not a boss. |
| `fantasy/low-poly-boss-arena.glb` | Floor 2/3 arena blockout | 14,788 | Directly useful layout prop; all parts static and low-poly. |
| `fantasy/low-poly-slime-set.glb` | Low-tier enemy visual reference | 8,064 | Static set; no AI rig or animation. |
| `fantasy/bow-tier-set.glb` | Weapon inventory/loot | 6,924 | Static weapon display set; no equip sockets. |
| `fantasy/low-poly-shield-set.glb` | Shield loot/inventory | 6,890 | Static display set. |
| `fantasy/fantasy-stone-bridge.glb` | Floor 1/3 traversal dressing | 6,848 | Static low-poly bridge. |
| `fantasy/low-poly-pirate-ship.glb` | Not recommended for current floors | 5,044 | Static; theme mismatch. |
| `fantasy/dungeon-iron-door.glb` | Dungeon entrance/door dressing | 4,890 | Static; interaction/hinge behavior would need implementation. |
| `fantasy/low-poly-potion-set.glb` | Loot/inventory props | 4,802 | Static prop set. |
| `fantasy/dragon-egg-nest.glb` | Floor 3 nest dressing | 4,763 | Static; not an enemy/animation asset. |
| `fantasy/healing-fountain.glb` | Hub healing landmark | 4,596 | Static; interaction is not provided. |
| `fantasy/enchanted-treasure-chest.glb` | Hub/dungeon loot | 4,356 | Static; opening behavior is not provided. |
| `fantasy/alchemists-table.glb` | Hub crafting/set dressing | 4,344 | Static low-poly prop. |
| `fantasy/tiered-magic-staffs.glb` | Weapon loot/display | 4,288 | Static set. |
| `fantasy/spellbook-lectern.glb` | Hub or boss-room dressing | 4,194 | Static prop. |
| `fantasy/royal-throne-dais.glb` | Central hub interior | 3,748 | Static; complements a throne room, not a tower exterior. |
| `fantasy/club-goblin.glb` | Enemy silhouette/blockout only | 3,318 | Static, unrigged; not usable for live combat animation. |
| `fantasy/combat-vfx-mesh-set.glb` | Combat effect mesh source | 3,192 | Static meshes only; no effect animation/material behavior included. |
| `fantasy/knight-armor-stand.glb` | Hub armor display | 3,122 | Static armor stand; not wearable armor. |
| `fantasy/fortune-tellers-table.glb` | Hub prop | 2,912 | Static; style fit uncertain. |
| `fantasy/glowing-rune-waystone.glb` | Hub portal/wayfinding landmark | 2,664 | Static; emissive/interaction setup may be needed. |
| `fantasy/rune-stone-circle.glb` | Hub/floor arena marker | 2,608 | Static floor prop. |
| `fantasy/giant-fantasy-mushrooms.glb` | Optional forest dressing | 2,364 | Static; stylized fairytale look. |
| `fantasy/mana-crystal-nodes.glb` | Floor 2 resource/arena dressing | 2,308 | Static prop set. |
| `fantasy/magical-floating-lanterns.glb` | Hub lighting dressing | 1,894 | Static meshes; floating motion/light sources are not included. |
| `fantasy/tiered-sword-set.glb` | Weapon loot/display | 1,136 | Static set; no equipment integration. |

Raw GLB position-accessor bounds for the Fantasy models are listed below as
`X x Y x Z` in the file's encoded units. These are geometry extents before applying
node transforms, not guaranteed world-space dimensions; the README does not certify
a physical scale. In particular, some structures span tens of units, so scale and
orientation must be checked in a scene before use.

| Asset filename | Raw XYZ bounds |
| --- | --- |
| `leaning-wizard-tower.glb` | 18.940 x 38.022 x 19.469 |
| `elven-treehouse.glb` | 28.347 x 36.952 x 18.286 |
| `floating-sky-island.glb` | 37.308 x 36.817 x 36.720 |
| `dragon-treasure-hoard.glb` | 14.813 x 9.816 x 14.306 |
| `fairy-mushroom-house.glb` | 11.800 x 14.200 x 11.800 |
| `dragon-statue-fountain.glb` | 16.066 x 13.869 x 11.451 |
| `low-poly-boss-arena.glb` | 50.000 x 22.450 x 50.000 |
| `low-poly-slime-set.glb` | 4.948 x 3.910 x 4.916 |
| `bow-tier-set.glb` | 1.232 x 5.263 x 1.080 |
| `low-poly-shield-set.glb` | 3.000 x 5.458 x 0.960 |
| `fantasy-stone-bridge.glb` | 53.276 x 10.770 x 24.000 |
| `low-poly-pirate-ship.glb` | 25.000 x 73.200 x 80.630 |
| `dungeon-iron-door.glb` | 20.000 x 15.000 x 10.517 |
| `low-poly-potion-set.glb` | 1.135 x 2.037 x 1.165 |
| `dragon-egg-nest.glb` | 9.390 x 4.452 x 8.035 |
| `healing-fountain.glb` | 12.800 x 10.650 x 14.700 |
| `enchanted-treasure-chest.glb` | 5.600 x 3.630 x 4.750 |
| `alchemists-table.glb` | 8.400 x 7.400 x 3.600 |
| `tiered-magic-staffs.glb` | 1.613 x 6.205 x 0.850 |
| `spellbook-lectern.glb` | 6.240 x 5.080 x 6.322 |
| `royal-throne-dais.glb` | 16.100 x 10.760 x 12.900 |
| `club-goblin.glb` | 2.700 x 3.955 x 2.127 |
| `combat-vfx-mesh-set.glb` | 10.000 x 7.953 x 10.000 |
| `knight-armor-stand.glb` | 5.100 x 9.873 x 3.700 |
| `fortune-tellers-table.glb` | 12.000 x 12.920 x 6.720 |
| `glowing-rune-waystone.glb` | 20.166 x 10.140 x 16.560 |
| `rune-stone-circle.glb` | 29.000 x 11.580 x 29.000 |
| `giant-fantasy-mushrooms.glb` | 16.500 x 16.345 x 16.500 |
| `mana-crystal-nodes.glb` | 9.163 x 8.749 x 8.254 |
| `magical-floating-lanterns.glb` | 2.473 x 3.984 x 2.600 |
| `tiered-sword-set.glb` | 1.699 x 4.520 x 0.391 |

## ZIP: `hollowreach-pack.zip`

The archive is GLB 2.0 and includes embedded PNG PBR images: generally three
1024x1024 maps per model; `vale-shieldmaiden` has three 2048x2048 images. The three
environment GLBs use one 1536x857 image each. This is the most promising set for
rigged RPG actors on technical metadata alone. However, the ZIP has no license,
attribution, creator, README, or source manifest. Treat all included models,
images, music, and sound as **rights unverified**. Per the user's approval, that
does not block local technical testing; do not distribute until provenance and
license are reviewed. A skinned mesh is not proof that its animation, scale,
materials, or appearance fits R.E.D.

| Asset filename | Intended use | Triangles; rig/animations | Compatibility / licensing concerns |
| --- | --- | --- | --- |
| `hollowreach/arms/arming-sword.glb` | Player weapon | 5,940; static | GLB with three 1024 maps; no socket/pivot review; rights unverified. |
| `hollowreach/creatures/marsh-direwolf.glb` | Wolf prototype | 39,798; 31 joints; no clips | Rigged and textured; would need licensed walk/run/attack/idle clips or new animation. |
| `hollowreach/creatures/ashfen-dragon.glb` | Dragon enemy candidate, Floor 3 | 39,634; 39 joints; no clips | Rigged static pose; animation and combat behavior absent. |
| `hollowreach/creatures/gloom-stalker.glb` | Humanoid enemy | 39,957; 28 joints; 12 clips | Clips: idle, walk/run, turns, combat idle, punches, kick, dodge, hit, death. Clip/rig review needed. |
| `hollowreach/creatures/hollow-wyrm.glb` | Wyrm enemy candidate, Floor 3 | 39,896; 48 joints; no clips | Skinned, but no animation clips. |
| `hollowreach/creatures/marsh-python.glb` | Serpent enemy | 39,937; 21 joints; no clips | Skinned, but no animation clips. |
| `hollowreach/dungeon/enemy-bone-sentry.png` | Enemy concept/UI image | N/A | PNG image, not a 3D model. Rights unverified. |
| `hollowreach/dungeon/enemy-hollow-warden.png` | Enemy concept/UI image | N/A | PNG image, not a 3D model. |
| `hollowreach/dungeon/enemy-marsh-wraith.png` | Enemy concept/UI image | N/A | PNG image, not a 3D model. |
| `hollowreach/environments/environment-hall.glb` | Dungeon/hub environment blockout | 156,008; static | Two meshes, one 1536x857 embedded image; large scene and rights unverified. |
| `hollowreach/environments/environment-hall.png` | Hall reference/render | N/A | Image; not a texture/model. |
| `hollowreach/environments/environment-town.glb` | Hub/town blockout | 118,914; static | Two meshes, one 1536x857 image; rights unverified. |
| `hollowreach/environments/environment-town.png` | Town reference/render | N/A | Image; not a texture/model. |
| `hollowreach/environments/environment-vault.glb` | Dungeon vault/boss-room blockout | 147,052; static | Two meshes, one 1536x857 image; rights unverified. |
| `hollowreach/environments/environment-vault.png` | Vault reference/render | N/A | Image; not a texture/model. |
| `hollowreach/town/market-stall.glb` | Hub/town prop | 9,559; static | Three 1024 maps; rights unverified. |
| `hollowreach/town/npc-merchant.png` | NPC reference image | N/A | PNG image, not a 3D NPC. |
| `hollowreach/town/prop-barrel.png` | Prop reference/image | N/A | PNG image, not a 3D prop. |
| `hollowreach/town/prop-gate.png` | Prop reference/image | N/A | PNG image, not a 3D prop. |
| `hollowreach/dungeon/room-chamber.png` | Chamber reference/render | N/A | Image; not a GLB room. |
| `hollowreach/dungeon/room-corridor.png` | Corridor reference/render | N/A | Image; not a GLB room. |
| `hollowreach/dungeon/room-vault.png` | Vault reference/render | N/A | Image; not a GLB room. |
| `hollowreach/arms/shield-face.png` | Shield texture/reference | N/A | PNG; mapping/use cannot be confirmed without asset provenance. |
| `hollowreach/dungeon/texture-floor.png` | Dungeon floor texture | N/A | PNG; texture resolution and license need verification before use. |
| `hollowreach/town/texture-road.png` | Town road texture | N/A | PNG; texture resolution and license need verification. |
| `hollowreach/dungeon/texture-stone.png` | Dungeon stone texture | N/A | PNG; texture resolution and license need verification. |
| `hollowreach/town/town-square.png` | Town reference/render | N/A | Image; not a model. |
| `hollowreach/ui/ui-meter-frame.png` | UI frame candidate | N/A | PNG, not a game component. |
| `hollowreach/ui/ui-rune-ring.png` | UI/effect image | N/A | PNG; not an animated effect. |
| `hollowreach/ui/ui-ward-ring.png` | UI/effect image | N/A | PNG; not an animated effect. |
| `hollowreach/arms/wall-torch.glb` | Interior prop | 6,026; static | Three 1024 maps; rights unverified. |
| `hollowreach/arms/warden-greatsword.glb` | Weapon/loot | 5,992; static | Three 1024 maps; rights unverified. |
| `hollowreach/characters/ashfen-ranger.glb` | Playable ranger/NPC candidate | 39,003; 34 joints; 5 clips | Idle, walk/run, and left/right turn clips; promising metadata, but license and visual/runtime review required. |
| `hollowreach/characters/vale-shieldmaiden.glb` | Playable character candidate | 98,258; 52 joints; 15 clips | Best-described combat set (locomotion, attacks, block, bash, parry, stagger, knockdown/get-up); largest model and 2K maps; rights unverified. |
| `hollowreach/characters/hollow-warden.glb` | Humanoid enemy/NPC | 39,251; 52 joints; 15 clips | Similar named combat clips to shieldmaiden; possible shared rig/clip family, but not confirmed. |
| `hollowreach/props/supply-crate.glb` | Hub/dungeon prop | 7,934; static | Three 1024 maps; rights unverified. |
| `hollowreach/props/wayfarer-lantern.glb` | Hub prop | 11,792; static | Three 1024 maps; rights unverified. |
| `hollowreach/props/reach-shrine.glb` | Hub/level shrine | 19,980; static | Three 1024 maps; rights unverified. |
| `hollowreach/characters/vale-reference.png` | Character reference | N/A | Image, not a model or texture confirmed for the GLB. |
| `hollowreach/art/hollowreach-key-art.png` | Promotional art/reference | N/A | Not a game environment or texture. |
| `hollowreach/art/ashfen-marsh.png` | Environment reference | N/A | Not a game environment or texture. |
| `hollowreach/art/last-gate-inn.png` | Environment reference | N/A | Not a game environment or texture. |
| `hollowreach/music/warden-wakes.mp3` | Music candidate | N/A | MP3; rights unverified. |
| `hollowreach/music/marshlight.mp3` | Music candidate | N/A | MP3; rights unverified. |
| `hollowreach/music/hollowreach-theme.mp3` | Music candidate | N/A | MP3; rights unverified. |
| `hollowreach/sfx/chest-open.wav` | Sound effect candidate | N/A | WAV; rights unverified. |
| `hollowreach/sfx/gate-rise.wav` | Sound effect candidate | N/A | WAV; rights unverified. |
| `hollowreach/sfx/potion-drink.wav` | Sound effect candidate | N/A | WAV; rights unverified. |
| `hollowreach/sfx/warden-roar.wav` | Sound effect candidate | N/A | WAV; rights unverified. |
| `hollowreach/sfx/sword-impact.wav` | Sound effect candidate | N/A | WAV; rights unverified. |
| `hollowreach/sfx/ui-confirm.wav` | Sound effect candidate | N/A | WAV; rights unverified. |
| `hollowreach/voice/gate-merchant.flac` | Voice line candidate | N/A | FLAC; rights/performer consent unverified. |
| `hollowreach/voice/opening-narration.flac` | Narration candidate | N/A | FLAC; rights/performer consent unverified. |
| `hollowreach/voice/narration-level.flac` | Narration candidate | N/A | FLAC; rights/performer consent unverified. |
| `hollowreach/voice/warden-line.flac` | Voice line candidate | N/A | FLAC; rights/performer consent unverified. |
| `hollowreach/voice/warden-battle-cry.flac` | Voice line candidate | N/A | FLAC; rights/performer consent unverified. |

For the Hollowreach GLBs, raw position-accessor bounds (`X x Y x Z`) are
particularly useful for screening scale. They are encoded geometry extents before
node transforms, in unspecified units, not certified real-world dimensions.
Inspect node transforms and rendered scale before loading into R.E.D.:

| Asset filename | Raw XYZ bounds |
| --- | --- |
| `arming-sword.glb` | 0.921 x 0.697 x 0.296 |
| `marsh-direwolf.glb` | 0.858 x 0.809 x 0.612 |
| `ashfen-dragon.glb` | 0.947 x 0.795 x 0.605 |
| `gloom-stalker.glb` | 0.375 x 0.873 x 0.237 |
| `hollow-wyrm.glb` | 0.816 x 0.811 x 0.497 |
| `marsh-python.glb` | 0.869 x 0.281 x 0.673 |
| `environment-hall.glb` | 3.370 x 4.145 x 16.660 |
| `environment-town.glb` | 130.627 x 43.238 x 210.040 |
| `environment-vault.glb` | 13.090 x 6.556 x 12.999 |
| `market-stall.glb` | 0.763 x 0.773 x 0.870 |
| `wall-torch.glb` | 0.348 x 0.823 x 0.755 |
| `warden-greatsword.glb` | 0.879 x 0.861 x 0.382 |
| `ashfen-ranger.glb` | 0.323 x 0.880 x 0.224 |
| `vale-shieldmaiden.glb` | 0.537 x 0.912 x 0.208 |
| `hollow-warden.glb` | 0.383 x 0.968 x 0.342 |
| `supply-crate.glb` | 0.877 x 0.736 x 0.983 |
| `wayfarer-lantern.glb` | 0.517 x 0.827 x 0.516 |
| `reach-shrine.glb` | 0.505 x 0.895 x 0.567 |

## Loose workspace GLBs

These are at the repository root, not in `RED/public/assets`. All five have glTF
2.0 containers generated by Blender glTF I/O or glTF-Transform and embed three
JPEG images. The four named subjects have no skins or animation clips; their image
maps are 4096x4096. They are high polygon-count and large download/runtime-memory
candidates. Their author, source, and license are not recorded in adjacent files.

| Asset filename | Format / geometry | Intended use | Compatibility / licensing concerns |
| --- | --- | --- | --- |
| `crystal-dragon.glb` | GLB; 799,999 tris; one static mesh; 3 x 4096 JPEG PBR images; accessor extent about 4.82 x 4.95 x 6.00 | Dragon statue/showcase or static boss placeholder, Floor 3 | Not animated; nearly 800k triangles and three 4K images are excessive for a live creature. No license/source. |
| `medieval-villager.glb` | GLB; 647,846 tris; one static mesh; 3 x 4096 JPEG PBR images; extent about 1.14 x 1.75 x 0.42 | Static background display only | No skeleton or animation; unsuitable as a playable character/NPC as-is and very heavy. No license/source. |
| `phoenix.glb` | GLB; 800,000 tris; one static mesh; 3 x 4096 JPEG PBR images; extent about 2.50 x 2.47 x 1.69 | Static arena statue/showcase only, Floor 2 | No skin or animation; not a combat-ready phoenix. High polygon/texture cost. No license/source. |
| `under.glb` | GLB; 46,625 tris; 1 skin with 24 joints; one clip `Armature\|clip0\|baselayer`; 3 x 2048 JPEG images; armature node scaled 0.01 | Possible humanoid prototype after inspection | Actual subject/clip intent is unclear from file name; only one generic clip; verify pose, visual content, scale, skeleton mapping, and license before considering. |
| `wolf.glb` | GLB; 448,652 tris; one static mesh; 3 x 4096 JPEG PBR images; extent about 1.10 x 1.31 x 1.70 | Static wolf statue/showcase only | No skin or animations, so not suitable for the live AI wolf. High polygon/texture cost. No license/source. |

The project separately has three existing terrain images:
`RED/public/assets/terrain/forest_ground_04_diff_1k.jpg`,
`forest_ground_04_nor_gl_1k.jpg`, and `forest_ground_04_rough_1k.jpg`.
The existing asset manifest records them as Poly Haven / Rob Tuytel and Rico
Cilliers, CC0 1.0.

## Duplicate and compatibility findings

- `crimson-obsidian-sentinel (1).zip` is not readable as a conventional ZIP by
  Python `zipfile` or `unzip`: it has no end-of-central-directory record. `bsdtar`
  can stream-list 137 local names, but reports zero sizes. The listing contains
  68 GLBs and 68 FBXs but only 34 unique basenames, both `(1)` and unnumbered
  variants, plus a nested `dark-dungeon-props-v1.2.0.zip`. No PNG, license, or
  readme names are recoverable. This strongly suggests a duplicate/nested package;
  byte-for-byte identity cannot be verified from its damaged directory. Prefer the
  valid `dark-dungeon-props-v1.2.0.zip`.
- Dark Dungeon Props supplies a GLB and FBX version for each of its 34 models.
  Treat these as alternate formats for the same asset, not separate assets. Prefer
  its self-contained GLB files with Three.js; do not import both representations.
- `crystal-dragon.glb` and Hollowreach's `ashfen-dragon.glb` are related by subject,
  but not exact duplicates: one is static and extremely dense; the other is a
  39-joint skinned model without animation clips. Likewise, `wolf.glb` is not a
  duplicate of the skinned `marsh-direwolf.glb`.
- `medieval-villager.glb` is not an animated alternative to Hollowreach's rigged
  character files. `under.glb` is rigged, but its name and generic clip do not
  establish that it is a usable player model.
- All GLBs are glTF 2.0 containers suitable in principle for Three.js `GLTFLoader`.
  This does not guarantee suitable axes, scale, pivots, bone naming, clip mapping,
  collision, or visual quality in R.E.D. The existing game's creature rig needs a
  model/animation adapter; the player has an asset-loader path, but no current
  configuration for these files.

## Approved local test direction and proposed assignments

| R.E.D. area | Proposed candidates | Assessment |
| --- | --- | --- |
| Central tower hub | `fantasy/leaning-wizard-tower.glb`, `fantasy/royal-throne-dais.glb`, `fantasy/glowing-rune-waystone.glb`, `fantasy/magical-floating-lanterns.glb`; optionally Dark Dungeon `emberstone-throne` / `radiant-obelisk` | Best available tower/hub set, but the Fantasy kit is explicitly low-poly and has a different visual style. Dark pack is props, not a tower. Review together before committing to a style. |
| Floor 1: snowy forest / Nordic ruins | Existing forest terrain texture; Dark Dungeon `ironbound-timber-panel`, `nethergate-ruins`, `dismantled-expedition`, `tangle-of-antlers`; Fantasy `fantasy-stone-bridge.glb` | No complete snowy forest or Nordic ruins environment was found. These are detail props only; no full environment replacement candidate. |
| Floor 2: volcanic dungeon / Phoenix arena | Dark Dungeon `emberbound-cauldron`, `molten-obsidian-bastion`, `obsidian-ember-circle`, `runic-ember-circle`, `embervault-reliquary`; Fantasy `low-poly-boss-arena.glb` and `mana-crystal-nodes.glb` | Strong prop/theme match. All are static; the Phoenix source is a static 800k-triangle mesh. It needs a deforming rig and authored animations before combat use. |
| Floor 3: Dragon fortress / boss arena | Fantasy `low-poly-boss-arena.glb`, `dragon-statue-fountain.glb`, `dragon-egg-nest.glb`, `dragon-treasure-hoard.glb`; Dark Dungeon `spiral-stone-dragon`, `crumbling-stone-wings`, `crimson-obsidian-sentinel` | Useful static set dressing/blockout, not a full fortress. `crystal-dragon.glb` can only be considered for a static display after rights review and optimization. |
| Wolves / live enemies | Hollowreach `marsh-direwolf.glb`, `gloom-stalker.glb`, `ashfen-dragon.glb`, `hollow-wyrm.glb`; Fantasy `club-goblin.glb` / `low-poly-slime-set.glb` for blockout only | Hollowreach has the strongest rig/clip metadata but no license evidence; most creatures have no clips. Do not substitute static top-level `wolf.glb` or `phoenix.glb` for combat actors. |
| Player / NPCs | Hollowreach `ashfen-ranger.glb`, `vale-shieldmaiden.glb`, `hollow-warden.glb`; inspect `under.glb` only if its source is clarified | These are the most promising rigged humanoid candidates by mesh/bone/clip metadata. All require license verification, visual inspection, scale/pivot/animation review, and a tested fallback. |
| Weapons / armor | Fantasy `tiered-sword-set`, `bow-tier-set`, `low-poly-shield-set`, `tiered-magic-staffs`; Hollowreach `arming-sword`, `warden-greatsword`; Fantasy `knight-armor-stand` for display only | Mostly static display/loot meshes. No individual armor equipment set was found. Fantasy is licensed subject to its no-standalone-redistribution term; Hollowreach rights are unverified. |

### Distribution and player-visual gates

1. Local technical testing of user-provided assets is approved. Keep unknown
   provenance marked as unknown; review source/license before distribution.
2. The low-poly Fantasy kit remains excluded from the finished Skyrim-inspired
   game; do not use its models or placeholder visuals.
3. Keep the existing player model active until a rendered comparison is shown
   and the user explicitly approves a replacement.
4. Preserve source archives and originals. Keep preview copies separate from
   gameplay/release registration until the relevant visual, rig, animation, and
   release checks are complete.

## Phoenix browser inspection (2026-11-20)

- The staged `phoenix.glb` is byte-identical to the workspace-root original
  (`sha256 44802f73ea1ee3c7d9a64924d35d7307ee2532bdbdbb81b46bfcccdc81306e3c`).
- Source inspection reports one static mesh (`phoenix`), 800,000 triangles,
  455,984 uploaded vertices, an estimated 24.19 MiB mesh allocation, no skeleton,
  and no animation clips. Its single PBR material uses base-color, normal, and
  metallic/roughness maps, each 4096x4096 JPEG. The model extents are approximately
  2.499 x 2.472 x 1.685 units; its lowest vertex is about 0.00018 above the origin.
- The original crashed the tested Codespaces SwiftShader Chromium renderer, even
  with preview shadows disabled, so a full-resolution browser A/B screenshot was
  not possible. An intermediate 199,992-triangle/2048px derivative also crashed.
  The selected `phoenix-optimized-100k.glb` renders in Chromium: 99,996 triangles,
  80,256 uploaded vertices, 1024px base-color/normal/metallic-roughness maps, and
  3.96 MiB. Its extents are within about 0.2% of the source; it visibly retains the
  upright body, head, wings, feathers, and feet. This supports scale/pivot and
  silhouette review but cannot prove close-up detail equivalence to the source.
- The derivative preserves the source normal map. It has no authored `TANGENT`
  attribute; Three.js r170 uses a fragment-derivative tangent frame when the
  tangent attribute is absent, and the model renders without browser errors.
  `gltf-transform validate` reports no structural errors but warns runtime tangent
  generation may be implementation-dependent. Tangents generated after
  simplification contained two zero-length vectors and were discarded; generation
  on the full source did not finish in the available environment. Do not remove the
  normal map to silence this warning.
- No animation was fabricated. Before Phoenix combat use, separate or retopologize
  the body, head/neck, wings, and tail; create and weight a skeleton with
  independently deforming wings; then author and test takeoff, flight/hover,
  landing, attack, hit, and defeat animations. A rigid whole-mesh rotation is not
  an acceptable substitute.
