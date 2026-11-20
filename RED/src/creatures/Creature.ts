import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import type { CreatureKind, CreatureMood } from '../core/types';
import type { AssetManager } from '../core/AssetManager';
import { createCreatureRig, type CreatureRig } from '../actors/CreatureRig';
import { disposeActorModel } from '../actors/ActorGeometry';
import { loadCreatureAsset, type GLTFCreatureRig } from './CreatureAssetLoader';
import type { CreatureAssetConfig } from './CreatureAssetConfig';

export interface CreatureBossConfig {
  id: string;
  name: string;
  health: number;
  damage: number;
  range: number;
  size: number;
  modelHeight?: number;
  hoverHeight?: number;
}

export class Creature {
  readonly model = new THREE.Group();
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  health: number;
  mood: CreatureMood;
  attackCooldown = 0;
  readonly bossId: string | null;
  readonly bossName: string | null;
  readonly displayName: string;
  readonly maxHealth: number;
  bossPhase = 1;
  visualAnimationStatus = 'Procedural fallback active';
  private readonly controller: RAPIER.KinematicCharacterController;
  private readonly origin: THREE.Vector3;
  private readonly groundOffset: number;
  private readonly bossConfig: CreatureBossConfig | null;
  private visualRig!: CreatureRig;
  private damagePending = false;
  private damageAnimationRemaining = 0;
  private disposed = false;
  private attackWindup = 0;
  private attackAnimationRemaining = 0;
  private attackSpecial = false;
  private elapsed = 0;
  private knockbackRemaining = 0;
  private readonly knockbackDirection = new THREE.Vector3();
  private readonly healthBar: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly healthBarTrack: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly attackTelegraph: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null;

  constructor(
    readonly kind: CreatureKind,
    position: THREE.Vector3,
    private readonly physics: RAPIER.World,
    private readonly assets: AssetManager,
    private readonly surfaceHeightAt: (x: number, z: number) => number = () => 0,
    boss: CreatureBossConfig | null = null,
    assetConfig: CreatureAssetConfig | null = null,
  ) {
    this.origin = position.clone();
    this.bossConfig = boss;
    this.bossId = boss?.id ?? null;
    this.bossName = boss?.name ?? null;
    this.displayName = boss?.name ?? assetConfig?.label ?? `${kind[0].toUpperCase()}${kind.slice(1)}`;
    this.maxHealth = boss?.health ?? (kind === 'bear' ? 100 : kind === 'wolf' ? 62 : 34);
    this.health = this.maxHealth;
    this.mood = kind === 'wolf' ? 'hostile' : kind === 'deer' ? 'passive' : 'territorial';
    const size = boss?.size ?? 1;
    const halfHeight = (kind === 'bear' ? 0.42 : 0.26) * size;
    const radius = (kind === 'bear' ? 0.42 : 0.38) * size;
    this.groundOffset = halfHeight + radius;
    this.body = physics.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        position.x,
        this.surfaceHeightAt(position.x, position.z) + this.groundOffset,
        position.z,
      ),
    );
    this.collider = physics.createCollider(
      RAPIER.ColliderDesc.capsule(halfHeight, radius).setFriction(0),
      this.body,
    );
    this.controller = physics.createCharacterController(0.03);
    this.controller.setSlideEnabled(true);
    this.createModel();
    if (assetConfig) void this.loadImportedModel(assetConfig);
    if (boss && !assetConfig) this.visualRig.model.scale.setScalar(size);
    const barWidth = boss ? 1.65 : 0.8;
    this.healthBarTrack = new THREE.Mesh(
      new THREE.PlaneGeometry(barWidth, boss ? 0.12 : 0.08),
      new THREE.MeshBasicMaterial({ color: 0x20251f, side: THREE.DoubleSide }),
    );
    this.healthBar = new THREE.Mesh(
      new THREE.PlaneGeometry(barWidth * 0.95, boss ? 0.08 : 0.05),
      new THREE.MeshBasicMaterial({ color: boss ? 0xc94736 : 0x9e493c, side: THREE.DoubleSide }),
    );
    this.healthBar.position.z = 0.01;
    this.healthBarTrack.position.set(0, this.height + (boss ? 0.5 : 0.2), 0);
    this.healthBar.position.set(0, this.height + (boss ? 0.5 : 0.2), 0.015);
    this.model.add(this.healthBarTrack, this.healthBar);
    if (boss) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xe75d43,
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.attackTelegraph = new THREE.Mesh(new THREE.RingGeometry(1.4 * size, 1.9 * size, 40), material);
      this.attackTelegraph.rotation.x = -Math.PI / 2;
      this.attackTelegraph.position.y = 0.035;
      this.attackTelegraph.visible = false;
      this.model.add(this.attackTelegraph);
    } else {
      this.attackTelegraph = null;
    }
  }

  private get height(): number {
    return this.bossConfig?.modelHeight
      ?? (this.kind === 'bear' ? 1.6 : this.kind === 'deer' ? 1.4 : 1.35) * (this.bossConfig?.size ?? 1);
  }

  get groundHeight(): number {
    return this.surfaceHeightAt(this.model.position.x, this.model.position.z) + this.groundOffset;
  }

  groundHeightAt(x: number, z: number): number {
    return this.surfaceHeightAt(x, z) + this.groundOffset;
  }

  private createModel(): void {
    const material = this.kind === 'wolf' ? this.assets.materials.wolf : this.kind === 'deer' ? this.assets.materials.deer : this.assets.materials.bear;
    this.visualRig = createCreatureRig(this.kind, material);
    this.model.add(this.visualRig.model);
  }

  private async loadImportedModel(config: CreatureAssetConfig): Promise<void> {
    let importedRig: GLTFCreatureRig;
    try {
      importedRig = await loadCreatureAsset(this.assets, config);
    } catch (error) {
      this.visualAnimationStatus = 'GLB failed · procedural fallback active';
      console.error(`Keeping the procedural ${config.label} fallback because its GLB could not be loaded.`, error);
      return;
    }
    if (this.disposed) {
      importedRig.dispose?.();
      return;
    }
    const previousRig = this.visualRig;
    this.model.remove(previousRig.model);
    this.visualRig = importedRig;
    this.model.add(importedRig.model);
    this.visualAnimationStatus = importedRig.report.status === 'Static'
      ? 'Static pose · no skeleton or clips'
      : importedRig.report.status === 'Rigged - no clips'
        ? 'Rigged pose · no animation clips'
        : `${importedRig.report.clips.length} authored animation clips`;
    if (previousRig.dispose) previousRig.dispose();
    else disposeActorModel(previousRig.model);
  }

  update(
    delta: number,
    playerPosition: THREE.Vector3,
    callbacks: { damagePlayer: (damage: number) => void },
  ): void {
    if (this.mood === 'dead') {
      this.visualRig.update(delta, 0, false, false, this.damagePending, true, false);
      this.damagePending = false;
      return;
    }
    this.elapsed += delta;
    const position = this.body.translation();
    const current = new THREE.Vector3(position.x, position.y, position.z);
    const distance = current.distanceTo(playerPosition);
    const takingDamage = this.damagePending || this.damageAnimationRemaining > 0;
    this.damageAnimationRemaining = Math.max(0, this.damageAnimationRemaining - delta);
    this.attackAnimationRemaining = Math.max(0, this.attackAnimationRemaining - delta);
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    if (this.attackWindup > 0) {
      this.attackWindup = Math.max(0, this.attackWindup - delta);
      if (this.attackTelegraph) {
        const pulse = 0.9 + Math.sin((0.62 - this.attackWindup) * 20) * 0.08;
        this.attackTelegraph.scale.setScalar(pulse);
        this.attackTelegraph.visible = true;
      }
      if (this.attackWindup === 0) {
        const hitRange = this.bossConfig?.range ?? (this.kind === 'bear' ? 2.5 : 1.8);
        if (distance <= hitRange) {
          const baseDamage = this.bossConfig?.damage ?? (this.kind === 'bear' ? 19 : 9);
          callbacks.damagePlayer(this.bossPhase === 2 ? Math.round(baseDamage * 1.4) : baseDamage);
          this.attackCooldown = this.kind === 'bear' ? 1.9 : 1.35;
        } else {
          this.attackCooldown = 0.35;
        }
        if (this.attackTelegraph) this.attackTelegraph.visible = false;
      }
    }
    let target: THREE.Vector3 | null = null;
    let speed = 0;
    let attackStarted = false;
    let specialAttack = false;
    if (this.mood === 'tamed') {
      if (distance > 3.2) {
        target = playerPosition;
        speed = 4;
      }
    } else if (this.bossConfig) {
      if (distance < 28) {
        if (distance > this.bossConfig.range) {
          target = playerPosition;
          speed = this.bossPhase === 2 ? 5.6 : 4.1;
        } else if (this.attackCooldown === 0 && this.attackWindup === 0) {
          this.attackWindup = this.bossPhase === 2 ? 0.48 : 0.72;
          attackStarted = true;
          specialAttack = this.bossPhase === 2;
          if (this.attackTelegraph) this.attackTelegraph.visible = true;
        }
      } else if (current.distanceTo(this.origin) > 1.5) {
        target = this.origin;
        speed = 1.5;
      }
    } else if (this.kind === 'deer') {
      if (distance < 9) {
        target = current.clone().sub(playerPosition).normalize().add(current);
        speed = 5.2;
      } else if (current.distanceTo(this.origin) > 2.5) {
        target = this.origin;
        speed = 2.2;
      }
    } else if (this.kind === 'wolf' && distance < 13) {
      if (distance > 1.8) {
        target = playerPosition;
        speed = 3.5;
      } else if (this.attackCooldown === 0 && this.attackWindup === 0) {
        this.attackWindup = 0.38;
        attackStarted = true;
      }
    } else if (this.kind === 'bear' && distance < 10) {
      if (distance > 2.5) {
        target = playerPosition;
        speed = 2.45;
      } else if (this.attackCooldown === 0 && this.attackWindup === 0) {
        this.attackWindup = 0.62;
        attackStarted = true;
        specialAttack = true;
      }
    } else if (current.distanceTo(this.origin) > 1.5) {
      target = this.origin;
      speed = 1.5;
    }
    if (attackStarted) {
      this.attackAnimationRemaining = this.bossConfig ? 0.82 : this.kind === 'bear' ? 0.86 : 0.68;
      this.attackSpecial = specialAttack;
    }

    let dx = 0;
    let dz = 0;
    let movementSpeed = 0;
    if (target) {
      const direction = target.clone().sub(current).setY(0);
      if (direction.lengthSq() > 0.01) {
        direction.normalize();
        dx = direction.x * speed * delta;
        dz = direction.z * speed * delta;
        movementSpeed = speed;
        const desiredYaw = Math.atan2(direction.x, direction.z);
        const yawDelta = Math.atan2(
          Math.sin(desiredYaw - this.model.rotation.y),
          Math.cos(desiredYaw - this.model.rotation.y),
        );
        this.model.rotation.y += yawDelta * (1 - Math.exp(-10 * delta));
      }
    }
    if (this.knockbackRemaining > 0) {
      const strength = this.knockbackRemaining / 0.18;
      dx += this.knockbackDirection.x * 4.5 * strength * delta;
      dz += this.knockbackDirection.z * 4.5 * strength * delta;
      this.knockbackRemaining = Math.max(0, this.knockbackRemaining - delta);
    }
    this.controller.computeColliderMovement(this.collider, { x: dx, y: -0.1, z: dz });
    const movement = this.controller.computedMovement();
    const nextX = position.x + movement.x;
    const nextZ = position.z + movement.z;
    const groundHeight = this.surfaceHeightAt(nextX, nextZ);
    this.body.setNextKinematicTranslation({
      x: nextX,
      y: Math.max(groundHeight + this.groundOffset - 0.02, position.y + movement.y),
      z: nextZ,
    });
    this.model.position.set(nextX, Math.max(groundHeight, position.y + movement.y - this.groundOffset), nextZ);
    const hoverHeight = this.bossConfig?.hoverHeight ?? 0;
    this.visualRig.model.position.y = hoverHeight + Math.sin(this.elapsed * 2.2) * (hoverHeight > 0 ? 0.08 : 0);
    this.visualRig.update(
      delta,
      movementSpeed > 0 ? 1 : 0,
      movementSpeed >= 4.8,
      this.attackAnimationRemaining > 0,
      takingDamage,
      false,
      this.attackSpecial && this.attackAnimationRemaining > 0,
    );
    if (this.attackAnimationRemaining === 0) this.attackSpecial = false;
    this.damagePending = false;
    this.healthBarTrack.quaternion.copy(this.model.quaternion).invert();
    this.healthBar.quaternion.copy(this.healthBarTrack.quaternion);
    this.healthBar.scale.x = Math.max(0.01, this.health / this.maxHealth);
    this.healthBar.position.x = -(1 - this.healthBar.scale.x) * (this.bossConfig ? 0.78 : 0.38);
  }

  takeDamage(amount: number, knockbackDirection?: THREE.Vector3): void {
    if (this.mood === 'dead' || this.mood === 'tamed') return;
    this.health = Math.max(0, this.health - amount);
    if (this.bossConfig) this.bossPhase = this.health <= this.maxHealth * 0.5 ? 2 : 1;
    this.damagePending = true;
    this.damageAnimationRemaining = 0.38;
    if (knockbackDirection && knockbackDirection.lengthSq() > 0) {
      this.knockbackDirection.copy(knockbackDirection).setY(0).normalize();
      this.knockbackRemaining = 0.18;
    }
    if (this.health === 0) {
      this.mood = 'dead';
      this.collider.setEnabled(false);
      this.healthBarTrack.visible = false;
      this.healthBar.visible = false;
      if (this.attackTelegraph) this.attackTelegraph.visible = false;
    }
  }

  tame(): void {
    this.mood = 'tamed';
    this.health = Math.max(this.health, 1);
  }

  dispose(): void {
    this.disposed = true;
    this.physics.removeCharacterController(this.controller);
    this.physics.removeRigidBody(this.body);
    if (this.visualRig.dispose) {
      this.visualRig.dispose();
      this.healthBarTrack.geometry.dispose();
      this.healthBarTrack.material.dispose();
      this.healthBar.geometry.dispose();
      this.healthBar.material.dispose();
      this.attackTelegraph?.geometry.dispose();
      this.attackTelegraph?.material.dispose();
    } else {
      disposeActorModel(this.model);
    }
  }
}
