# R.E.D. Blender Asset Pipeline

This is the repeatable intake path for character and creature assets (humans, elves,
dwarves, Beastkin, wolves, goblins, skeletons, trolls, and dragons). A candidate is
not approved merely because it is rigged or exports successfully. Do not register it
or replace the procedural player until the source, visual quality, rig, and exported
asset have all passed review.

## 1. Install and pin Blender

Blender is free and open source. It was **not installed or available on PATH** in the
development environment checked for this pipeline.

- Download a stable release from the [official Blender downloads page](https://www.blender.org/download/).
- Prefer an official LTS release for repeatable project work. Install the matching
  Windows installer or macOS disk image, or download and extract the official Linux
  `.tar.xz` archive. On Linux, run `tar -xf blender-<version>-linux-x64.tar.xz`,
  then run `./blender --version` from the extracted Blender directory. No third-party
  package or unofficial build is needed.
- Record the exact version used with `blender --version`. Use the same version for
  inspection and export, and record any deliberate version change in the asset review.

On Linux, after extracting the official archive, run the executable from its extracted
directory, for example:

```sh
./blender --version
./blender --background --disable-autoexec /path/to/source.blend \
  --python scripts/blender/inspect_blend.py -- --report /tmp/asset-review.json
```

`--disable-autoexec` prevents automatic execution of embedded Blender scripts while
opening third-party `.blend` files. Treat source files as untrusted; inspect them with
auto-execution disabled and do not enable embedded scripts to make an asset work.

## 2. Acquire and review the source license

Before downloading or shipping an asset, record the original download page, named
creator/uploader, exact license and version, attribution requirements, and any
third-party components. Read the actual source page and license; do not infer rights
from an accessible download. For CC BY-SA assets, preserve attribution and the license
notice, disclose changes, and have distribution obligations reviewed before release.
An asset that cannot be legally approved does not proceed.

### Elven archer candidate (not approved)

- Source page: [OpenGameArt — Rigged, textured elven archer](https://opengameart.org/content/rigged-textured-elven-archer)
- OGA page author/uploader: **thecubber**. The supplied attribution to “cruzr” does
  not match the page metadata: CruzR appears on the page as a commenter. Confirm the
  intended creator credit before shipping.
- License shown on the source page: **CC-BY-SA 3.0**. This exact version is not
  currently accepted by `validateRiggedActorReview` in
  `src/actors/GLTFCharacterRig.ts`; do not bypass that gate or register the model
  without an explicit license decision.
- Source file listed by OGA: `ELF_rig_057_fin.blend`, **62.8 MB**.
- The source page reports approximately 8.5k body, 3.5k head, 2.5k bow, and 700
  hair triangles, plus body 2k, head 1k, bow 1k, and hair 512x512 textures. These
  are uploader-provided figures, not independently measured.
- The page describes Blender-specific skin subsurface and cloth ramp shaders. They
  need inspection and likely a reviewed PBR rebuild.
- The published still shows a clothed elf with a visible face, cloak, bow, and quiver.
  It is useful for initial screening only. It does not establish close-up facial or
  anatomy quality, texture integrity, geometry cleanliness, skeleton usability,
  texture dependencies, runtime appearance, or compatibility with R.E.D.
- **Decision: pending.** Blender is not installed here and the source `.blend` has
  not been opened. Do not convert, attribute as approved, or add it to the asset
  manifest/player configuration based on this still.

## 3. Inspect the `.blend` before editing or approving

Download the source from its verified page, then produce a machine-readable report:

```sh
blender --background --disable-autoexec /path/to/source.blend \
  --python scripts/blender/inspect_blend.py -- \
  --report /tmp/elven-archer-review.json
```

Review the actual model in Blender as well as the report:

1. Render the source in a neutral three-point light setup, and inspect front, back,
   side, face close-up, hands, feet, equipment, and silhouette. Judge anatomy,
   proportions, clothing/equipment intersections, texture detail, and whether it
   meets the game's realistic fantasy RPG bar. Record screenshots and a pass/fail
   decision; a source-page preview is not a substitute.
2. Inspect mesh counts, overlapping/hidden pieces, duplicate geometry, normals,
   UVs, modifiers, and material assignments. Remove only geometry confirmed unused
   or redundant; do not decimate merely to meet a size target.
3. Inspect armature hierarchy, deform bones, mesh armature modifiers, vertex groups,
   weight painting, rest pose, and animation actions/NLA tracks. Scrub any included
   actions and verify that the skin deforms correctly.
4. Inspect every material's active output and image nodes, packed/missing images,
   dimensions, color spaces, and alpha. Identify unsupported Blender shader graphs
   before replacing them with PBR.
5. Record the measured scene triangle count, skeleton bone count, image dimensions,
   missing/external resources, and render-review verdict. An unknown or failed check
   blocks approval.

## 4. Convert materials and export

The export script requires every exported material's active output to be driven
directly by a Principled BSDF. It preserves compatible base-color, metallic,
roughness, and normal inputs for Blender's glTF exporter. It disables the Principled
subsurface weight because glTF's core metallic-roughness material cannot represent
the candidate's described fake skin SSS. Unsupported shader networks are rejected
instead of silently flattened; rebuild those materials as reviewed Principled PBR
materials in Blender first.

The default keeps all source image dimensions and geometry. The optional texture cap
is explicit and only downsizes images above the chosen edge length. Use it only after
comparing renders; no size budget justifies visible damage. The exporter keeps skinning
and animation export enabled, does not apply modifiers, and embeds resources in GLB.
It purges Blender datablocks with no users; this does not remove referenced character
geometry or resources.

After review and any manual PBR work, export with the same pinned Blender version:

```sh
blender --background --disable-autoexec /path/to/reviewed.blend \
  --python scripts/blender/export_glb.py -- \
  --output public/assets/characters/example.glb \
  --report /tmp/example-export.json
```

Optional, only when source textures exceed the cap and visual comparison approves:

```sh
blender --background --disable-autoexec /path/to/reviewed.blend \
  --python scripts/blender/export_glb.py -- \
  --output public/assets/characters/example.glb \
  --max-texture-size 2048 --report /tmp/example-export.json
```

The summary records file size, geometry, skeletons, actions, and resized images.
Inspect the GLB by reopening it in Blender (or importing it into a clean scene) and
compare its pose, materials, textures, animation, and visual details against the
approved source. Verify the GLB is self-contained and note its measured size and
dependencies. The script's success is not a visual QA pass.

## 5. Animation and retargeting

First inspect the actual source rig and any embedded actions; do not infer clips from
a rig or from a source listing. If external clips are needed, check the animation
provider's current license and the permitted use in this game before downloading.
Test a candidate clip on a duplicate file and inspect rest-pose alignment, bone-name
mapping, root motion, scale, and deformation. Retarget where necessary, then export
and inspect the actual named clips. Record only clips present in the exported GLB;
map those exact names to R.E.D.'s logical animation states (`idle`, `walk`, `run`,
`attack`, `hit`, `death`, `block`, `jump`). Do not claim an animation is available
until its source, license, clip, and export have been checked.

## 6. Register in R.E.D. and verify in game

Only after all preceding checks pass:

1. Add the self-contained GLB under `public/assets/` and add a manifest row in
   `public/assets/ASSET_MANIFEST.md` with the confirmed creator, exact license,
   source/download page, attribution, change notice, and file path.
2. Record measured face count, max texture edge, external resource count (zero for a
   self-contained GLB), bone count, and exact animation clip names in the review
   record. Ensure the current validation in `GLTFCharacterRig.ts` accepts the
   verified license and measured budgets before configuring the asset.
3. Add its race/creature config in the existing asset configuration and map only
   verified clip names. Keep the existing procedural fallback in place. Do not add
   another actor adapter or change gameplay ownership.
4. Run `npm run build`, then launch the game and test first-/third-person views,
   ground alignment, scale, movement, transitions, materials, error fallback, and
   cleanup. A merge-ready/player-replacement claim requires a real approved model
   visibly rendered in the running game.

For manual browser verification, run `npm ci` and `npm run dev`, open Vite's printed
URL, start an Elf character, switch to third person with **V**, and inspect the
character at rest from front and back. Walk, sprint, jump, attack, block, take damage,
and die/respawn while checking animation transitions, ground contact, proportions,
bow/weapon attachment, texture/material appearance, and console/network errors. Also
test first person, dispose/restart the game, and verify a deliberately unavailable
test asset logs a load failure and keeps the procedural fallback. Do not edit the
production config to point at an unreviewed asset just to run these checks.

Keep the source file, review renders/report, Blender version, export summary, and
license evidence with the asset's review materials. Do not ship the large editable
source `.blend` unless distribution rights and the repository's asset policy allow it.
