import * as THREE from 'three';
import type { CreatureRig } from '../actors/CreatureRig';
import type { AssetManager, LoadedModel } from '../core/AssetManager';
import type { CreatureAnimationState, CreatureAssetConfig } from './CreatureAssetConfig';

export interface CreatureTextureReport {
  material: string;
  slot: string;
  width: number;
  height: number;
}

export interface CreatureAssetReport {
  path: string;
  fileSizeBytes: number;
  status: 'Static' | 'Rigged - no clips' | 'Rigged - clips available';
  triangleCount: number;
  meshCount: number;
  skinnedMeshCount: number;
  bones: string[];
  clips: string[];
  materials: string[];
  textures: CreatureTextureReport[];
  sourceBounds: { width: number; height: number; depth: number };
  displayedBounds: { width: number; height: number; depth: number };
  appliedScale: number;
  appliedYawDegrees: number;
}

function getSourceBounds(scene: THREE.Object3D): THREE.Box3 {
  scene.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(scene);
}

function getTextureSize(texture: THREE.Texture): { width: number; height: number } {
  const image = texture.image as { width?: number; height?: number } | undefined;
  return {
    width: image?.width ?? 0,
    height: image?.height ?? 0,
  };
}

export function inspectCreatureAsset(
  loaded: LoadedModel,
  config: CreatureAssetConfig,
  fileSizeBytes: number,
): CreatureAssetReport {
  const bones = new Set<THREE.Bone>();
  const materials = new Set<string>();
  const textures: CreatureTextureReport[] = [];
  let triangleCount = 0;
  let meshCount = 0;
  let skinnedMeshCount = 0;

  loaded.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    meshCount++;
    const indexCount = object.geometry.index?.count ?? object.geometry.getAttribute('position')?.count ?? 0;
    const instanceCount = object instanceof THREE.InstancedMesh ? object.count : 1;
    triangleCount += Math.floor(indexCount / 3) * instanceCount;

    if (object instanceof THREE.SkinnedMesh) {
      skinnedMeshCount++;
      object.skeleton.bones.forEach((bone) => bones.add(bone));
    }

    const materialList = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materialList) {
      materials.add(material.name || material.type);
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      const slots: Array<[string, THREE.Texture | null]> = [
        ['base color', material.map],
        ['normal', material.normalMap],
        ['roughness', material.roughnessMap],
        ['metalness', material.metalnessMap],
        ['ambient occlusion', material.aoMap],
        ['emissive', material.emissiveMap],
      ];
      for (const [slot, texture] of slots) {
        if (!texture) continue;
        const { width, height } = getTextureSize(texture);
        textures.push({ material: material.name || material.type, slot, width, height });
      }
    }
  });

  const bounds = getSourceBounds(loaded.scene);
  const size = bounds.getSize(new THREE.Vector3());
  if (!meshCount) throw new Error(`The model "${config.path}" contains no renderable meshes.`);
  if (!Number.isFinite(size.y) || size.y <= 0) {
    throw new Error(`The model "${config.path}" has invalid vertical bounds.`);
  }
  if (!Number.isFinite(config.targetHeight) || config.targetHeight <= 0) {
    throw new Error(`The model "${config.path}" has an invalid target height.`);
  }

  const appliedScale = config.targetHeight / size.y;
  const status = skinnedMeshCount === 0
    ? 'Static'
    : loaded.animations.length === 0
      ? 'Rigged - no clips'
      : 'Rigged - clips available';

  return {
    path: config.path,
    fileSizeBytes,
    status,
    triangleCount,
    meshCount,
    skinnedMeshCount,
    bones: [...bones].map((bone) => bone.name || '(unnamed bone)'),
    clips: loaded.animations.map((clip) => clip.name),
    materials: [...materials],
    textures,
    sourceBounds: { width: size.x, height: size.y, depth: size.z },
    displayedBounds: {
      width: size.x * appliedScale,
      height: size.y * appliedScale,
      depth: size.z * appliedScale,
    },
    appliedScale,
    appliedYawDegrees: THREE.MathUtils.radToDeg(config.rotationY ?? 0),
  };
}

export class GLTFCreatureRig implements CreatureRig {
  readonly model = new THREE.Group();
  readonly report: CreatureAssetReport;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private readonly clips: Map<string, THREE.AnimationClip>;
  private readonly animationMap: Partial<Record<CreatureAnimationState, string>>;
  private activeAction: THREE.AnimationAction | null = null;
  private activeClipName: string | null = null;
  private disposed = false;

  constructor(
    private readonly loaded: LoadedModel,
    config: CreatureAssetConfig,
    private readonly assets: AssetManager,
    fileSizeBytes: number,
  ) {
    this.report = inspectCreatureAsset(loaded, config, fileSizeBytes);
    const bounds = getSourceBounds(loaded.scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = config.targetHeight / size.y;

    this.model.rotation.y = config.rotationY ?? 0;
    this.model.scale.setScalar(scale);
    this.animationMap = config.animationMap ?? {};
    loaded.scene.position.set(-center.x, -bounds.min.y, -center.z);
    loaded.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    this.model.add(loaded.scene);
    this.mixer = new THREE.AnimationMixer(loaded.scene);
    this.clips = new Map(loaded.animations.map((clip) => [clip.name, clip]));
  }

  setTargetHeight(height: number): void {
    if (!Number.isFinite(height) || height <= 0) return;
    this.model.scale.setScalar(height / this.report.sourceBounds.height);
    this.report.displayedBounds = {
      width: this.report.sourceBounds.width * this.model.scale.x,
      height,
      depth: this.report.sourceBounds.depth * this.model.scale.z,
    };
    this.report.appliedScale = this.model.scale.x;
  }

  setYawDegrees(degrees: number): void {
    if (!Number.isFinite(degrees)) return;
    this.model.rotation.y = THREE.MathUtils.degToRad(degrees);
    this.report.appliedYawDegrees = degrees;
  }

  playClip(name: string, loop = true): boolean {
    const clip = this.clips.get(name);
    if (!clip || this.disposed) return false;
    if (this.activeClipName === name && this.activeAction
      && (this.activeAction.isRunning() || this.activeAction.paused)) return true;

    this.activeAction?.fadeOut(0.12);
    let action = this.actions.get(name);
    if (!action) {
      action = this.mixer.clipAction(clip);
      this.actions.set(name, action);
    }
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.fadeIn(0.12).play();
    this.activeAction = action;
    this.activeClipName = name;
    return true;
  }

  stopClip(): void {
    this.activeAction?.fadeOut(0.12);
    this.activeAction = null;
    this.activeClipName = null;
  }

  update(
    delta: number,
    movement: number,
    running: boolean,
    attacking: boolean,
    takingDamage: boolean,
    dead: boolean,
    _special: boolean,
  ): void {
    if (this.disposed) return;
    const state: CreatureAnimationState = dead
      ? 'death'
      : takingDamage
        ? 'hit'
        : attacking
          ? _special ? 'special' : 'attack'
          : movement > 0.01
            ? running ? 'run' : 'walk'
            : 'idle';
    const clipName = this.animationMap[state];
    const loops = state === 'idle' || state === 'walk' || state === 'run';
    if (clipName && this.clips.has(clipName)) this.playClip(clipName, loops);
    else if (this.activeClipName) this.stopClip();
    this.mixer.update(delta);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.loaded.scene);
    this.assets.releaseModel(this.loaded.scene);
    this.actions.clear();
    this.model.clear();
  }
}

export async function loadCreatureAsset(
  assets: AssetManager,
  config: CreatureAssetConfig,
): Promise<GLTFCreatureRig> {
  const response = await fetch(assets.resolveAssetUrl(config.path), { method: 'HEAD' });
  if (!response.ok) {
    throw new Error(`Could not load "${config.path}": HTTP ${response.status}.`);
  }
  const fileSizeBytes = Number(response.headers.get('content-length')) || 0;
  const loaded = await assets.loadModel(config.path, () => new THREE.Group());

  try {
    return new GLTFCreatureRig(loaded, config, assets, fileSizeBytes);
  } catch (error) {
    assets.releaseModel(loaded.scene);
    throw error;
  }
}

export class CreatureAssetLoader {
  constructor(private readonly assets: AssetManager) {}

  load(config: CreatureAssetConfig): Promise<GLTFCreatureRig> {
    return loadCreatureAsset(this.assets, config);
  }
}
