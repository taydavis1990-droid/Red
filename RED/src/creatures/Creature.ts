import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import type { CreatureKind, CreatureMood } from '../core/types';
import type { AssetManager } from '../core/AssetManager';
import { createCreatureRig, type CreatureRig } from '../actors/CreatureRig';
import { disposeActorModel } from '../actors/ActorGeometry';

export class Creature {
  readonly model = new THREE.Group();
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  health: number;
  mood: CreatureMood;
  attackCooldown = 0;
  private readonly controller: RAPIER.KinematicCharacterController;
  private readonly origin: THREE.Vector3;
  private readonly groundOffset: number;
  private visualRig!: CreatureRig;
  private damagePending = false;
  private attackWindup = 0;
  private knockbackRemaining = 0;
  private readonly knockbackDirection = new THREE.Vector3();
  private readonly healthBar: THREE.Mesh;
  private readonly healthBarTrack: THREE.Mesh;

  constructor(
    readonly kind: CreatureKind,
    position: THREE.Vector3,
    private readonly physics: RAPIER.World,
    private readonly assets: AssetManager,
    private readonly surfaceHeightAt: (x: number, z: number) => number = () => 0,
  ) {
    this.origin = position.clone();
    this.health = kind === 'bear' ? 100 : kind === 'wolf' ? 62 : 34;
    this.mood = kind === 'wolf' ? 'hostile' : kind === 'deer' ? 'passive' : 'territorial';
    const halfHeight = kind === 'bear' ? 0.42 : 0.26;
    const radius = kind === 'bear' ? 0.42 : 0.38;
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
    this.healthBarTrack = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x20251f, side: THREE.DoubleSide }),
    );
    this.healthBar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.76, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x9e493c, side: THREE.DoubleSide }),
    );
    this.healthBar.position.z = 0.01;
    this.healthBarTrack.position.set(0, this.height + 0.2, 0);
    this.healthBar.position.set(0, this.height + 0.2, 0.015);
    this.model.add(this.healthBarTrack, this.healthBar);
  }

  private get height(): number {
    return this.kind === 'bear' ? 1.65 : this.kind === 'deer' ? 1.35 : 1.05;
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
    const position = this.body.translation();
    const current = new THREE.Vector3(position.x, position.y, position.z);
    const distance = current.distanceTo(playerPosition);
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    if (this.attackWindup > 0) {
      this.attackWindup = Math.max(0, this.attackWindup - delta);
      if (this.attackWindup === 0) {
        const hitRange = this.kind === 'bear' ? 2.5 : 1.8;
        if (distance <= hitRange) {
          callbacks.damagePlayer(this.kind === 'bear' ? 19 : 9);
          this.attackCooldown = this.kind === 'bear' ? 1.9 : 1.35;
        } else {
          this.attackCooldown = 0.35;
        }
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
        this.model.rotation.y = Math.atan2(direction.x, direction.z);
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
    this.visualRig.update(
      delta,
      movementSpeed > 0 ? 1 : 0,
      movementSpeed >= 4.8,
      attackStarted,
      this.damagePending,
      false,
      specialAttack,
    );
    this.damagePending = false;
    this.healthBarTrack.quaternion.copy(this.model.quaternion).invert();
    this.healthBar.quaternion.copy(this.healthBarTrack.quaternion);
    this.healthBar.scale.x = Math.max(0.01, this.health / (this.kind === 'bear' ? 100 : this.kind === 'wolf' ? 62 : 34));
    this.healthBar.position.x = -(1 - this.healthBar.scale.x) * 0.38;
  }

  takeDamage(amount: number, knockbackDirection?: THREE.Vector3): void {
    if (this.mood === 'dead' || this.mood === 'tamed') return;
    this.health = Math.max(0, this.health - amount);
    this.damagePending = true;
    if (knockbackDirection && knockbackDirection.lengthSq() > 0) {
      this.knockbackDirection.copy(knockbackDirection).setY(0).normalize();
      this.knockbackRemaining = 0.18;
    }
    if (this.health === 0) {
      this.mood = 'dead';
      this.collider.setEnabled(false);
      this.healthBarTrack.visible = false;
      this.healthBar.visible = false;
    }
  }

  tame(): void {
    this.mood = 'tamed';
    this.health = Math.max(this.health, 1);
  }

  dispose(): void {
    this.physics.removeCharacterController(this.controller);
    this.physics.removeRigidBody(this.body);
    disposeActorModel(this.model);
  }
}
