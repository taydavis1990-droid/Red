import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import type { AssetManager } from '../core/AssetManager';
import type { Attributes, CharacterData } from '../core/types';
import { PLAYER_CHARACTER_ASSETS } from '../actors/CharacterAssetConfig';
import { CameraManager } from './CameraManager';
import { createCharacterRig, type CharacterRig } from '../actors/CharacterRig';
import { GLTFCharacterRig, type RiggedCharacterAssetConfig } from '../actors/GLTFCharacterRig';
import { disposeActorModel } from '../actors/ActorGeometry';

export class Player {
  readonly model = new THREE.Group();
  readonly cameraManager: CameraManager;
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  health: number;
  stamina: number;
  mana: number;
  blocking = false;
  private verticalSpeed = 0;
  private attackPending = false;
  private damagePending = false;
  private readonly capsuleRadius: number;
  private readonly capsuleHalfHeight: number;
  private visualRig!: CharacterRig;
  private attackTrail!: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private firstPersonAttackTrail!: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private firstPersonWeapon!: THREE.Group;
  private attackTrailMaterial!: THREE.MeshBasicMaterial;
  private attackEffectRemaining = 0;
  private attackSequence = 0;
  private elapsed = 0;
  private disposed = false;

  constructor(
    private readonly physics: RAPIER.World,
    private readonly camera: THREE.PerspectiveCamera,
    readonly character: CharacterData,
    private readonly groundHeightAt: (x: number, z: number) => number = () => 0,
    private readonly assets?: AssetManager,
  ) {
    this.health = character.attributes.health;
    this.stamina = character.attributes.stamina;
    this.mana = character.attributes.mana;
    this.cameraManager = new CameraManager(camera);
    this.capsuleRadius = character.race === 'Dwarf' ? 0.33 : character.race === 'Elf' ? 0.36 : 0.38;
    this.capsuleHalfHeight = character.race === 'Dwarf' ? 0.37 : character.race === 'Elf' ? 0.57 : 0.52;
    const bodyHeight = this.capsuleHalfHeight + this.capsuleRadius;
    this.body = physics.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        0,
        this.groundHeightAt(0, 13) + bodyHeight,
        13,
      ),
    );
    this.collider = physics.createCollider(
      RAPIER.ColliderDesc.capsule(this.capsuleHalfHeight, this.capsuleRadius).setFriction(0),
      this.body,
    );
    const controller = physics.createCharacterController(0.04);
    controller.setSlideEnabled(true);
    controller.setApplyImpulsesToDynamicBodies(true);
    this.controller = controller;
    this.createModel();
  }

  private readonly controller: RAPIER.KinematicCharacterController;

  private createModel(): void {
    this.visualRig = createCharacterRig(this.character.race);
    this.model.add(this.visualRig.model);
    const actorConfig = PLAYER_CHARACTER_ASSETS[this.character.race];
    if (actorConfig && this.assets) void this.loadImportedModel(actorConfig, this.assets);
    this.attackTrailMaterial = new THREE.MeshBasicMaterial({
      color: 0xe7ca82,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.attackTrail = new THREE.Mesh(
      new THREE.TorusGeometry(0.96, 0.06, 8, 36, Math.PI * 1.12),
      this.attackTrailMaterial,
    );
    this.attackTrail.position.set(0, -0.32, 0.08);
    this.attackTrail.rotation.set(0, 0, -1.08);
    this.attackTrail.visible = false;
    this.attackTrail.castShadow = false;
    this.attackTrail.receiveShadow = false;
    const weaponSocket = this.visualRig.model.getObjectByName('WeaponSocket') ?? this.visualRig.model;
    weaponSocket.add(this.attackTrail);
    this.firstPersonAttackTrail = new THREE.Mesh(this.attackTrail.geometry, this.attackTrailMaterial);
    this.firstPersonAttackTrail.position.set(0.42, -0.2, -0.72);
    this.firstPersonAttackTrail.rotation.set(0, 0, -1.08);
    this.firstPersonAttackTrail.visible = false;
    this.camera.add(this.firstPersonAttackTrail);
    this.createFirstPersonWeapon();
    this.model.position.set(0, this.groundHeightAt(0, 13), 13);
  }

  private async loadImportedModel(config: RiggedCharacterAssetConfig, assets: AssetManager): Promise<void> {
    const loaded = await assets.loadModel(config.path, () => new THREE.Group());
    if (this.disposed) {
      assets.releaseModel(loaded.scene);
      return;
    }

    let importedRig: GLTFCharacterRig;
    try {
      importedRig = new GLTFCharacterRig(loaded, config, assets);
    } catch (error) {
      assets.releaseModel(loaded.scene);
      console.warn(`Keeping the procedural ${this.character.race} model: ${config.path} was rejected.`, error);
      return;
    }

    const previousRig = this.visualRig;
    this.attackTrail.removeFromParent();
    const weaponSocket = importedRig.model.getObjectByName(config.weaponSocketName ?? 'WeaponSocket')
      ?? importedRig.model;
    weaponSocket.add(this.attackTrail);
    this.model.remove(previousRig.model);
    this.visualRig = importedRig;
    this.model.add(importedRig.model);
    if (previousRig.dispose) previousRig.dispose();
    else disposeActorModel(previousRig.model);
  }

  private createFirstPersonWeapon(): void {
    const weapon = new THREE.Group();
    weapon.position.set(0.36, -0.34, -0.72);
    this.firstPersonWeapon = weapon;
    this.camera.add(weapon);

    const sleeve = new THREE.MeshStandardMaterial({ color: 0x35443a, roughness: 0.88 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x493326, roughness: 0.76 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x9ca8a7, roughness: 0.27, metalness: 0.84 });
    const edgeSteel = new THREE.MeshStandardMaterial({ color: 0xd1d4c8, roughness: 0.2, metalness: 0.9 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x536061, roughness: 0.36, metalness: 0.82 });
    const brass = new THREE.MeshStandardMaterial({ color: 0x9b7840, roughness: 0.36, metalness: 0.7 });

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.32, 5, 10), sleeve);
    forearm.position.set(0.16, -0.28, 0.045);
    forearm.rotation.z = 2.58;
    weapon.add(forearm);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.084, 0.093, 0.12, 12, 1, true), leather);
    cuff.position.set(0.075, -0.14, 0.02);
    cuff.rotation.z = 2.58;
    weapon.add(cuff);
    for (const offset of [-0.045, 0.045]) {
      const cuffTrim = new THREE.Mesh(new THREE.TorusGeometry(0.087, 0.008, 6, 16), brass);
      cuffTrim.position.set(0.075 + Math.sin(2.58) * offset, -0.14 + Math.cos(2.58) * offset, 0.02);
      cuffTrim.rotation.set(Math.PI / 2, 0, 2.58);
      weapon.add(cuffTrim);
    }

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), leather);
    hand.position.set(0.015, -0.045, 0.015);
    hand.scale.set(0.92, 0.78, 0.72);
    weapon.add(hand);

    const hilt = new THREE.Group();
    hilt.position.set(0.005, -0.08, -0.018);
    hilt.rotation.z = -0.12;
    weapon.add(hilt);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.032, 0.19, 12), leather);
    grip.position.y = -0.095;
    hilt.add(grip);
    for (let index = 0; index < 5; index++) {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 5, 12), brass);
      wrap.position.y = -0.16 + index * 0.03;
      hilt.add(wrap);
    }

    const guardCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.2, -0.015, 0),
      new THREE.Vector3(-0.14, 0.035, 0),
      new THREE.Vector3(0, 0.045, 0),
      new THREE.Vector3(0.14, 0.035, 0),
      new THREE.Vector3(0.2, -0.015, 0),
    ]);
    hilt.add(new THREE.Mesh(new THREE.TubeGeometry(guardCurve, 24, 0.022, 8, false), brass));

    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.045, 0.055);
    bladeShape.lineTo(-0.078, 0.2);
    bladeShape.lineTo(-0.065, 0.78);
    bladeShape.lineTo(0, 1.04);
    bladeShape.lineTo(0.065, 0.78);
    bladeShape.lineTo(0.078, 0.2);
    bladeShape.lineTo(0.045, 0.055);
    bladeShape.closePath();
    const blade = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bladeShape, {
        depth: 0.035,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 0.012,
        bevelThickness: 0.012,
      }),
      steel,
    );
    blade.position.z = -0.02;
    hilt.add(blade);

    for (const side of [-1, 1]) {
      const edgeShape = new THREE.Shape();
      edgeShape.moveTo(side * 0.061, 0.22);
      edgeShape.lineTo(side * 0.052, 0.76);
      edgeShape.lineTo(side * 0.06, 0.72);
      edgeShape.lineTo(side * 0.07, 0.23);
      edgeShape.closePath();
      const edge = new THREE.Mesh(new THREE.ShapeGeometry(edgeShape), edgeSteel);
      edge.position.z = 0.023;
      hilt.add(edge);
    }

    const fullerShape = new THREE.Shape();
    fullerShape.moveTo(-0.012, 0.19);
    fullerShape.lineTo(0, 0.83);
    fullerShape.lineTo(0.012, 0.19);
    fullerShape.closePath();
    const fuller = new THREE.Mesh(new THREE.ShapeGeometry(fullerShape), darkSteel);
    fuller.position.set(0, 0, 0.024);
    hilt.add(fuller);

    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.046, 14, 10), brass);
    pommel.position.y = -0.205;
    hilt.add(pommel);
    const pommelInset = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), darkSteel);
    pommelInset.position.set(0, -0.205, 0.04);
    hilt.add(pommelInset);
  }

  update(
    delta: number,
    move: { x: number; y: number },
    cameraYaw: number,
    sprinting: boolean,
    jumping: boolean,
    look: { x: number; y: number },
  ): void {
    this.elapsed += delta;
    const position = this.body.translation();
    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    const direction = forward.multiplyScalar(-move.y).add(right.multiplyScalar(move.x));
    if (direction.lengthSq() > 0) direction.normalize();

    const wantsSprint = sprinting && (move.y !== 0 || move.x !== 0);
    const canSprint = wantsSprint && this.stamina > 0;
    const speed = canSprint ? 7.5 : 4.5;
    if (canSprint) this.stamina = Math.max(0, this.stamina - delta * 16);
    else this.stamina = Math.min(this.character.attributes.stamina, this.stamina + delta * 10);

    const grounded = this.controller.computedGrounded();
    if (jumping && grounded && this.stamina >= 12) {
      this.verticalSpeed = 7.2;
      this.stamina -= 12;
    }
    this.verticalSpeed -= 19.6 * delta;
    if (grounded && this.verticalSpeed < 0) this.verticalSpeed = -1;
    const desired = {
      x: direction.x * speed * delta,
      y: this.verticalSpeed * delta,
      z: direction.z * speed * delta,
    };
    this.controller.computeColliderMovement(this.collider, desired);
    const movement = this.controller.computedMovement();
    const bodyHeight = this.capsuleHalfHeight + this.capsuleRadius;
    const nextX = position.x + movement.x;
    const nextZ = position.z + movement.z;
    const groundHeight = this.groundHeightAt(nextX, nextZ);
    this.body.setNextKinematicTranslation({
      x: nextX,
      y: Math.max(groundHeight + bodyHeight - 0.05, position.y + movement.y),
      z: nextZ,
    });
    this.model.position.set(nextX, Math.max(groundHeight, position.y + movement.y - bodyHeight), nextZ);

    this.blocking = this.blocking && this.stamina > 0;
    if (this.blocking) this.stamina = Math.max(0, this.stamina - delta * 7);
    const moving = direction.lengthSq() > 0.01;
    this.visualRig.update(
      delta,
      moving ? 1 : 0,
      canSprint,
      this.attackPending,
      this.damagePending,
      this.health <= 0,
      this.blocking,
      !this.controller.computedGrounded(),
      this.attackSequence,
    );
    this.attackPending = false;
    this.damagePending = false;
    this.attackEffectRemaining = Math.max(0, this.attackEffectRemaining - delta);
    const activeTrail = this.attackEffectRemaining > 0;
    const firstPerson = this.cameraManager.mode === 'first-person';
    this.firstPersonWeapon.visible = firstPerson;
    this.attackTrail.visible = activeTrail && this.cameraManager.mode !== 'first-person';
    this.firstPersonAttackTrail.visible = activeTrail && firstPerson;
    const movementBlend = moving ? (canSprint ? 1 : 0.58) : 0;
    const idleBob = Math.sin(this.elapsed * (moving ? 9 : 1.8)) * (moving ? 0.012 : 0.004);
    this.firstPersonWeapon.position.set(
      0.36 + Math.cos(this.elapsed * 4.5) * movementBlend * 0.009,
      -0.34 + idleBob,
      -0.72,
    );
    this.firstPersonWeapon.rotation.set(
      -0.035 - movementBlend * 0.025,
      0.025 + Math.sin(this.elapsed * 3.2) * movementBlend * 0.018,
      0.34,
    );
    if (activeTrail) {
      const progress = 1 - this.attackEffectRemaining / 0.42;
      const attackPhase = progress < 0.32
        ? THREE.MathUtils.smoothstep(progress, 0, 0.32)
        : progress < 0.7
          ? THREE.MathUtils.smoothstep(progress, 0.32, 0.7)
          : 1 - THREE.MathUtils.smoothstep(progress, 0.7, 1);
      this.firstPersonWeapon.rotation.z += progress < 0.32
        ? attackPhase * 0.2
        : progress < 0.7
          ? THREE.MathUtils.lerp(0.2, -0.82, attackPhase)
          : THREE.MathUtils.lerp(-0.82, 0, attackPhase);
      this.firstPersonWeapon.position.y -= Math.sin(progress * Math.PI) * 0.045;
      this.attackTrailMaterial.opacity = (1 - progress) * 0.84;
      this.attackTrail.rotation.z = -1.08 + progress * 2.16;
      this.firstPersonAttackTrail.rotation.z = -1.08 + progress * 2.16;
      this.attackTrail.scale.setScalar(0.82 + progress * 0.48);
      this.firstPersonAttackTrail.scale.setScalar(0.82 + progress * 0.48);
    }
    const raceCameraHeight = {
      Human: { eye: 1.76, target: 1.05 },
      Elf: { eye: 1.9, target: 1.15 },
      Dwarf: { eye: 1.38, target: 0.82 },
      Beastkin: { eye: 1.79, target: 1.05 },
    }[this.character.race];
    this.cameraManager.update(this.model, look.x, look.y, delta, 0.003, raceCameraHeight.eye, raceCameraHeight.target);
  }

  attackAnimation(sequence = 0): void {
    this.attackSequence = sequence % 3;
    this.attackPending = true;
    this.attackEffectRemaining = 0.42;
    this.attackTrailMaterial.color.setHex([0xffd66b, 0xff9d55, 0x9fe8ff][this.attackSequence]);
    this.attackTrail.scale.setScalar(1);
    this.firstPersonAttackTrail.scale.setScalar(1);
    this.attackTrail.rotation.z = -1.08;
    this.firstPersonAttackTrail.rotation.z = -1.08;
    this.attackTrail.visible = this.cameraManager.mode !== 'first-person';
    this.firstPersonAttackTrail.visible = this.cameraManager.mode === 'first-person';
  }

  takeDamage(amount: number): void {
    const mitigation = Math.max(0, this.character.attributes.defense * 0.018);
    const damage = Math.max(1, amount * (this.blocking ? 0.3 : 1) * (1 - mitigation));
    this.health = Math.max(0, this.health - damage);
    this.damagePending = true;
  }

  restore(): void {
    this.health = this.character.attributes.health;
    this.stamina = this.character.attributes.stamina;
    this.mana = this.character.attributes.mana;
    this.model.rotation.z = 0;
    const bodyHeight = this.capsuleHalfHeight + this.capsuleRadius;
    const groundHeight = this.groundHeightAt(0, 13);
    this.body.setTranslation({ x: 0, y: groundHeight + bodyHeight, z: 13 }, true);
    this.model.position.set(0, groundHeight, 13);
    this.verticalSpeed = 0;
    this.blocking = false;
    this.attackEffectRemaining = 0;
    this.attackTrail.visible = false;
    this.firstPersonAttackTrail.visible = false;
  }

  get attributes(): Attributes {
    return this.character.attributes;
  }

  dispose(): void {
    this.disposed = true;
    this.camera.remove(this.firstPersonAttackTrail);
    this.camera.remove(this.firstPersonWeapon);
    this.attackTrail.removeFromParent();
    disposeActorModel(this.firstPersonWeapon);
    disposeActorModel(this.attackTrail);
    this.physics.removeRigidBody(this.body);
    this.physics.removeCharacterController(this.controller);
    this.model.remove(this.visualRig.model);
    if (this.visualRig.dispose) this.visualRig.dispose();
    else disposeActorModel(this.visualRig.model);
  }
}
