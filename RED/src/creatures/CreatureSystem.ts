import * as THREE from 'three';
import type * as RAPIER from '@dimforge/rapier3d-compat';
import type { AssetManager } from '../core/AssetManager';
import type { CharacterData } from '../core/types';
import { Creature } from './Creature';

export class CreatureSystem {
  readonly creatures: Creature[] = [];
  private spirit: THREE.Group | null = null;
  private spiritAura: THREE.Points | null = null;
  private spiritAuraMaterial: THREE.PointsMaterial | null = null;
  private spiritCooldown = 0;
  private spiritAttackTimer = 0;
  private spiritLife = 0;
  private readonly rewarded = new Set<Creature>();
  companion: Creature | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly physics: RAPIER.World,
    private readonly assets: AssetManager,
    character: CharacterData,
    private readonly surfaceHeightAt: (x: number, z: number) => number = () => 0,
  ) {
    this.spawn('wolf', new THREE.Vector3(-8, 0, 3));
    this.spawn('wolf', new THREE.Vector3(10, 0, -16));
    this.spawn('deer', new THREE.Vector3(7, 0, 9));
    this.spawn('deer', new THREE.Vector3(-19, 0, 5));
    this.spawn('bear', new THREE.Vector3(23, 0, 12));
    this.spawn('bear', new THREE.Vector3(-28, 0, -23));
    if (character.companions > 0) {
      const companion = this.spawn('wolf', new THREE.Vector3(1.2, 0, 14));
      companion.tame();
      this.companion = companion;
    }
  }

  private spawn(kind: 'wolf' | 'deer' | 'bear', position: THREE.Vector3): Creature {
    const creature = new Creature(kind, position, this.physics, this.assets, this.surfaceHeightAt);
    this.creatures.push(creature);
    this.scene.add(creature.model);
    return creature;
  }

  update(
    delta: number,
    playerPosition: THREE.Vector3,
    damagePlayer: (damage: number) => void,
    reward: (creature: Creature) => void,
  ): void {
    this.spiritCooldown = Math.max(0, this.spiritCooldown - delta);
    this.spiritAttackTimer -= delta;
    for (const creature of this.creatures) {
      creature.update(delta, playerPosition, { damagePlayer });
      if (creature.mood === 'dead' && !this.rewarded.has(creature)) {
        this.rewarded.add(creature);
        reward(creature);
      }
    }
    if (this.companion && this.companion.mood !== 'dead') {
      const distance = this.companion.model.position.distanceTo(playerPosition);
      const target = this.creatures.find((creature) =>
        (creature.kind === 'wolf' || creature.kind === 'bear')
        && creature.mood !== 'dead' && creature.mood !== 'tamed'
        && creature.model.position.distanceTo(this.companion!.model.position) < 7,
      );
      if (target && this.companion.model.position.distanceTo(target.model.position) < 1.8 && this.companion.attackCooldown <= 0) {
        target.takeDamage(6);
        this.companion.attackCooldown = 1;
      }
      if (distance > 20) {
        this.companion.body.setTranslation({
          x: playerPosition.x - 1,
          y: this.companion.groundHeightAt(playerPosition.x - 1, playerPosition.z - 1),
          z: playerPosition.z - 1,
        }, true);
      }
    }
    if (this.spirit) {
      this.spiritLife -= delta;
      const spiritX = playerPosition.x + Math.sin(this.spiritLife * 1.4) * 0.8;
      const spiritZ = playerPosition.z - 1.1;
      const spiritTime = 18 - this.spiritLife;
      this.spirit.position.set(
        spiritX,
        this.surfaceHeightAt(spiritX, spiritZ) + 0.55 + Math.sin(spiritTime * 2.4) * 0.07,
        spiritZ,
      );
      this.spirit.rotation.y += delta * 0.45;
      if (this.spiritAuraMaterial) this.spiritAuraMaterial.opacity = 0.38 + Math.sin(spiritTime * 3.2) * 0.12;
      this.spiritAura?.scale.setScalar(1 + Math.sin(spiritTime * 3.2) * 0.12);
      const target = this.creatures.find((creature) =>
        (creature.kind === 'wolf' || creature.kind === 'bear')
        && creature.mood !== 'dead' && creature.mood !== 'tamed'
        && creature.model.position.distanceTo(this.spirit!.position) < 8,
      );
      if (target && this.spiritAttackTimer <= 0) {
        target.takeDamage(12);
        this.spiritAttackTimer = 1.1;
      }
      if (this.spiritLife <= 0) this.dismissSpirit();
    }
  }

  tameNearest(playerPosition: THREE.Vector3): boolean {
    const wolf = this.creatures.find((creature) =>
      creature.kind === 'wolf' && creature.mood === 'hostile' && creature.health <= 24
      && creature.model.position.distanceTo(playerPosition) < 3,
    );
    if (!wolf) return false;
    wolf.tame();
    this.companion = wolf;
    return true;
  }

  summonSpirit(playerPosition: THREE.Vector3): boolean {
    if (this.spirit || this.spiritCooldown > 0) return false;
    this.spirit = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), this.assets.materials.spirit);
    body.scale.set(1.35, 0.85, 0.75);
    body.position.y = 0.65;
    this.spirit.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 6), this.assets.materials.spirit);
    head.position.set(0, 0.84, 0.48);
    this.spirit.add(head);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 4), this.assets.materials.spirit);
      ear.position.set(side * 0.17, 1.08, 0.48);
      this.spirit.add(ear);
    }
    const auraPositions = new Float32Array(20 * 3);
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      auraPositions[i * 3] = Math.cos(angle) * 0.62;
      auraPositions[i * 3 + 1] = 0.42 + Math.sin(i * 2.7) * 0.48;
      auraPositions[i * 3 + 2] = Math.sin(angle) * 0.52;
    }
    const auraGeometry = new THREE.BufferGeometry();
    auraGeometry.setAttribute('position', new THREE.BufferAttribute(auraPositions, 3));
    this.spiritAuraMaterial = new THREE.PointsMaterial({
      color: 0x9ce8d7,
      size: 0.09,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.spiritAura = new THREE.Points(auraGeometry, this.spiritAuraMaterial);
    this.spiritAura.frustumCulled = false;
    this.spirit.add(this.spiritAura);
    this.spirit.position.set(
      playerPosition.x,
      this.surfaceHeightAt(playerPosition.x, playerPosition.z - 1) + 0.55,
      playerPosition.z - 1,
    );
    this.scene.add(this.spirit);
    this.spiritCooldown = 35;
    this.spiritLife = 18;
    return true;
  }

  dismissSpirit(): void {
    if (!this.spirit) return;
    this.scene.remove(this.spirit);
    this.spirit.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) object.geometry.dispose();
    });
    this.spiritAuraMaterial?.dispose();
    this.spirit = null;
    this.spiritAura = null;
    this.spiritAuraMaterial = null;
  }

  get spiritActive(): boolean {
    return this.spirit !== null;
  }

  get spiritRemainingCooldown(): number {
    return this.spiritCooldown;
  }

  dispose(): void {
    this.dismissSpirit();
    for (const creature of this.creatures) {
      this.scene.remove(creature.model);
      creature.dispose();
    }
  }
}
