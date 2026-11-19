import * as THREE from 'three';
import type { AssetManager, LoadedModel } from '../core/AssetManager';
import type { CharacterRig } from './CharacterRig';

export type ActorAnimationState = 'idle' | 'walk' | 'run' | 'attack' | 'hit' | 'death' | 'block' | 'jump';

export type ActorAnimationMap = Partial<Record<ActorAnimationState, string | readonly string[]>>;

export interface RiggedActorReview {
  name: string;
  author: string;
  sourceUrl: string;
  license: string;
  fileSizeBytes: number;
  faceCount: number;
  maxTextureSize: number;
  externalResourceCount: number;
  skeletonBoneCount: number;
  animationClips: readonly string[];
  branded?: boolean;
  placeholder?: boolean;
}

export interface RiggedCharacterAssetConfig {
  path: string;
  targetHeight: number;
  groundOffset?: number;
  rotationY?: number;
  animations: ActorAnimationMap;
  weaponSocketName?: string;
  review: RiggedActorReview;
}

const ALLOWED_LICENSES = new Set([
  'CC0-1.0',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'MIT',
  'Apache-2.0',
]);

export function validateRiggedActorReview(review: RiggedActorReview): string[] {
  const failures: string[] = [];
  if (!review.name.trim() || /test|mannequin|placeholder|sample|cesium|primitive/i.test(review.name)) {
    failures.push('The asset name indicates a test, sample, mannequin, or placeholder model.');
  }
  if (!review.author.trim() || !review.sourceUrl.startsWith('https://')) {
    failures.push('The credited author and original HTTPS source are required.');
  }
  if (!ALLOWED_LICENSES.has(review.license)) failures.push(`Unapproved or unverified license: ${review.license || 'missing'}.`);
  if (review.branded) failures.push('Branded sample content is not accepted.');
  if (review.placeholder) failures.push('Placeholder geometry is not accepted.');
  if (review.fileSizeBytes <= 0 || review.fileSizeBytes > 20 * 1024 * 1024) {
    failures.push('The model must be non-empty and no larger than 20 MiB.');
  }
  if (review.faceCount <= 0 || review.faceCount > 80_000) failures.push('The model must contain 1-80,000 faces.');
  if (review.maxTextureSize <= 0 || review.maxTextureSize > 2048) {
    failures.push('Textures must be no larger than 2048 pixels per side.');
  }
  if (review.externalResourceCount < 0 || review.externalResourceCount > 8) {
    failures.push('The model may reference no more than eight external resources.');
  }
  if (review.skeletonBoneCount < 12) failures.push('A usable character skeleton must contain at least 12 bones.');
  return failures;
}

export class GLTFCharacterRig implements CharacterRig {
  readonly model = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private readonly animationByName: Map<string, THREE.AnimationClip>;
  private activeAction: THREE.AnimationAction | null = null;
  private activeTransient: ActorAnimationState | null = null;
  private locomotionState: ActorAnimationState = 'idle';
  private disposed = false;

  constructor(
    private readonly loaded: LoadedModel,
    private readonly config: RiggedCharacterAssetConfig,
    private readonly assets: AssetManager,
  ) {
    const validationFailures = validateRiggedActorReview(config.review);
    if (validationFailures.length) throw new Error(validationFailures.join(' '));

    const bones = new Set<THREE.Bone>();
    const geometries = new Set<THREE.BufferGeometry>();
    let faceCount = 0;
    let maxTextureSize = 0;
    let hasSkinnedMesh = false;
    loaded.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) {
        hasSkinnedMesh = true;
        object.skeleton.bones.forEach((bone) => bones.add(bone));
      }
      if (!geometries.has(object.geometry)) {
        geometries.add(object.geometry);
        faceCount += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
      }
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (!(value instanceof THREE.Texture)) continue;
          const image = value.image as { width?: number; height?: number } | undefined;
          maxTextureSize = Math.max(maxTextureSize, image?.width ?? 0, image?.height ?? 0);
        }
      }
    });
    if (!hasSkinnedMesh || bones.size < 12) {
      throw new Error('The configured character model does not contain a usable skinned skeleton.');
    }
    if (bones.size !== config.review.skeletonBoneCount) {
      throw new Error(`Reviewed ${config.review.skeletonBoneCount} skeleton bones but loaded ${bones.size}.`);
    }
    if (faceCount > 80_000 || Math.abs(faceCount - config.review.faceCount) > Math.max(12, faceCount * 0.1)) {
      throw new Error(`The loaded model face count (${faceCount}) does not match the reviewed budget.`);
    }
    if (maxTextureSize > 2048 || maxTextureSize > config.review.maxTextureSize) {
      throw new Error(`The loaded texture size (${maxTextureSize}px) exceeds the reviewed budget.`);
    }

    const bounds = new THREE.Box3().setFromObject(loaded.scene);
    const sourceHeight = bounds.max.y - bounds.min.y;
    if (!Number.isFinite(sourceHeight) || sourceHeight <= 0 || !Number.isFinite(config.targetHeight) || config.targetHeight <= 0) {
      throw new Error('The configured character model has invalid bounds or target height.');
    }

    this.model.rotation.y = config.rotationY ?? 0;
    const scale = config.targetHeight / sourceHeight;
    this.model.scale.setScalar(scale);
    loaded.scene.position.y = (config.groundOffset ?? 0) / scale - bounds.min.y;
    this.model.add(loaded.scene);
    this.mixer = new THREE.AnimationMixer(loaded.scene);
    this.animationByName = new Map(loaded.animations.map((clip) => [clip.name, clip]));
  }

  update(
    delta: number,
    movement: number,
    sprinting: boolean,
    attacking: boolean,
    takingDamage: boolean,
    dead: boolean,
    blocking: boolean,
    jumping: boolean,
    attackSequence = 0,
  ): void {
    if (this.disposed) return;
    if (this.activeTransient === 'death' && !dead) {
      this.activeAction?.fadeOut(0.18);
      this.activeTransient = null;
      this.activeAction = null;
    }
    this.locomotionState = blocking
      ? 'block'
      : movement > 0.01
        ? sprinting ? 'run' : 'walk'
        : 'idle';

    const transient = dead ? 'death' : takingDamage ? 'hit' : attacking ? 'attack' : jumping ? 'jump' : null;
    if (transient) this.playTransient(transient, attackSequence);
    else if (this.activeTransient && this.activeTransient !== 'death' && !this.activeAction?.isRunning()) {
      this.activeTransient = null;
      this.activeAction = null;
    }

    if (!this.activeTransient) this.playLoop(this.locomotionState);
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

  private playTransient(state: ActorAnimationState, sequence: number): void {
    const action = this.resolveAction(state, sequence);
    if (!action) return;
    if (this.activeAction === action && this.activeTransient === state) return;
    this.activeAction?.fadeOut(0.12);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.fadeIn(0.12).play();
    this.activeAction = action;
    this.activeTransient = state;
  }

  private playLoop(state: ActorAnimationState): void {
    const action = this.resolveAction(state, 0);
    if (!action) {
      this.activeAction?.fadeOut(0.18);
      this.activeAction = null;
      return;
    }
    if (action === this.activeAction) return;
    this.activeAction?.fadeOut(0.18);
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.fadeIn(0.18).play();
    this.activeAction = action;
  }

  private resolveAction(state: ActorAnimationState, sequence: number): THREE.AnimationAction | null {
    const mapping = this.config.animations[state];
    if (!mapping) return null;
    const clipName = typeof mapping === 'string'
      ? mapping
      : mapping.length > 0 ? mapping[sequence % mapping.length] : undefined;
    if (!clipName || !this.animationByName.has(clipName)) return null;
    let action = this.actions.get(clipName);
    if (!action) {
      const clip = this.animationByName.get(clipName);
      if (!clip) return null;
      action = this.mixer.clipAction(clip);
      this.actions.set(clipName, action);
    }
    return action;
  }
}