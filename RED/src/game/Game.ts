import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { AssetManager } from '../core/AssetManager';
import { getGraphicsConfig, selectGraphicsConfig, type GraphicsQuality } from '../core/GraphicsConfig';
import { InputManager } from '../core/InputManager';
import { SaveManager } from '../core/SaveManager';
import { createCharacter, type CharacterData, type GameLocation, type Race } from '../core/types';
import { CreatureSystem } from '../creatures/CreatureSystem';
import type { Creature } from '../creatures/Creature';
import { createCharacterRig, type CharacterRig } from '../actors/CharacterRig';
import { disposeActorModel } from '../actors/ActorGeometry';
import { Player } from '../player/Player';
import { getWeaponDamageMultiplier } from '../player/WeaponConfig';
import { World } from '../world/World';
import { UI } from '../ui/UI';

interface HitEffect {
  points: THREE.Points;
  material: THREE.PointsMaterial;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  velocities: THREE.Vector3[];
  remaining: number;
  duration: number;
}

interface PendingAttack {
  target: Creature;
  damage: number;
  direction: THREE.Vector3;
  sequence: number;
  remaining: number;
}

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera = new THREE.PerspectiveCamera(68, 1, 0.1, 400);
  private graphics = selectGraphicsConfig();
  private readonly assets: AssetManager;
  private readonly saves = new SaveManager();
  private readonly input: InputManager;
  private readonly ui: UI;
  private physics!: RAPIER.World;
  private world!: World;
  private player: Player | null = null;
  private menuPreview: CharacterRig | null = null;
  private menuPreviewElapsed = 0;
  private menuPreviewScale = 1;
  private creatures: CreatureSystem | null = null;
  private savedCharacter: CharacterData | null = null;
  private playing = false;
  private disposed = false;
  private lastFrame = 0;
  private attackCooldown = 0;
  private comboStep = 0;
  private comboWindow = 0;
  private pendingAttack: PendingAttack | null = null;
  private readonly hitEffects: HitEffect[] = [];
  private respawnTimer = 0;
  private autoSaveTimer = 0;
  private deathTimeout = 0;
  private sprintTouch = false;
  private blockTouch = false;
  private pendingBossReturn: string | null = null;
  private promptText = '';
  private readonly lootDrops: Array<{ mesh: THREE.Mesh; item: string }> = [];
  private readonly onCanvasPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button === 0 && this.playing) {
      this.input.attackPressed = true;
    }
  };
  private readonly onCanvasContextMenu = (event: MouseEvent): void => { event.preventDefault(); };

  constructor(private readonly canvas: HTMLCanvasElement, root: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.graphics.antialias,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.graphics.maxPixelRatio));
    this.renderer.shadowMap.enabled = this.graphics.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.graphics.toneMappingExposure;
    this.assets = new AssetManager(
      Math.min(this.graphics.textureAnisotropy, this.renderer.capabilities.getMaxAnisotropy()),
    );
    this.input = new InputManager(root, canvas);
    this.ui = new UI(root, {
      start: (race, name) => this.startNewCharacter(race, name),
      preview: (race) => this.showMenuPreview(race),
      continue: () => this.continueCharacter(),
      attack: () => { this.input.attackPressed = true; },
      jump: () => { this.input.jumpPressed = true; },
      interact: () => { this.input.interactPressed = true; },
      spirit: () => { this.input.spiritPressed = true; },
      camera: () => { this.input.cameraPressed = true; },
      toggleInventory: () => this.toggleInventory(),
      equipItem: (item) => { void this.equipItem(item); },
      setGraphicsQuality: (quality) => this.setGraphicsQuality(quality),
      setBlocking: (blocked) => { this.blockTouch = blocked; },
      setSprinting: (sprinting) => { this.sprintTouch = sprinting; },
    });
    this.canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    this.canvas.addEventListener('contextmenu', this.onCanvasContextMenu);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  async start(): Promise<void> {
    await RAPIER.init();
    if (this.disposed) return;
    this.physics = new RAPIER.World({ x: 0, y: -19.6, z: 0 });
    this.physics.timestep = 1 / 60;
    this.world = new World(this.assets, this.physics, this.graphics, 'hub');
    this.world.scene.add(this.camera);
    this.positionMenuCamera();
    await this.saves.open();
    if (this.disposed) {
      this.saves.close();
      return;
    }
    this.savedCharacter = await this.saves.load();
    if (this.disposed) {
      this.saves.close();
      return;
    }
    if (this.savedCharacter && this.savedCharacter.tower.currentLocation !== this.world.location) {
      this.replaceWorld(this.savedCharacter.tower.currentLocation);
    }
    this.ui.showSavedCharacter(this.savedCharacter);
    this.renderer.setAnimationLoop(this.frame);
  }

  private startNewCharacter(race: Race, name: string): void {
    this.launchCharacter(createCharacter(race, name.slice(0, 20) || 'Wayfarer'));
  }

  private continueCharacter(): void {
    if (this.savedCharacter) this.launchCharacter(this.savedCharacter);
  }

  private launchCharacter(character: CharacterData): void {
    window.clearTimeout(this.deathTimeout);
    this.deathTimeout = 0;
    this.pendingBossReturn = null;
    if (this.playing) this.disposeActors();
    if (this.world.location !== character.tower.currentLocation) {
      this.replaceWorld(character.tower.currentLocation);
    }
    this.disposeMenuPreview();
    this.clearLootDrops();
    this.savedCharacter = character;
    this.player = new Player(
      this.physics,
      this.camera,
      character,
      (x, z) => this.world.getSurfaceHeight(x, z),
      this.assets,
    );
    this.world.scene.add(this.player.model);
    this.creatures = new CreatureSystem(
      this.world.scene,
      this.physics,
      this.assets,
      character,
      (x, z) => this.world.getSurfaceHeight(x, z),
      this.world.location,
    );
    this.world.startAmbience();
    this.playing = true;
    this.ui.startGame(character);
    this.ui.toastMessage(this.world.location === 'hub'
      ? `Welcome to the Eternal Sanctuary, ${character.name}.`
      : `Welcome back, ${character.name}.`);
    void this.persist();
  }

  private frame = (time: number): void => {
    if (this.disposed) return;
    const rawDelta = this.lastFrame === 0 ? 0 : (time - this.lastFrame) / 1000;
    const delta = Math.min(rawDelta, 0.05);
    this.lastFrame = time;
    this.physics.timestep = Math.max(delta, 1 / 120);
    this.world.update(delta);
    this.updateHitEffects(delta);
    if (this.playing && this.player && this.creatures) this.updateGame(delta);
    else this.updateMenuPreview(delta);
    this.renderer.render(this.world.scene, this.camera);
  };

  private showMenuPreview(race: Race): void {
    if (this.menuPreview) {
      this.world.scene.remove(this.menuPreview.model);
      disposeActorModel(this.menuPreview.model);
    }
    this.menuPreview = createCharacterRig(race);
    this.menuPreview.model.position.set(4.2, this.world.getSurfaceHeight(4.2, 8), 8);
    this.menuPreview.model.rotation.y = 0;
    this.menuPreview.model.scale.setScalar(0.82);
    this.world.scene.add(this.menuPreview.model);
    this.menuPreviewElapsed = 0;
    this.menuPreviewScale = 0;
    this.positionMenuCamera();
  }

  private updateMenuPreview(delta: number): void {
    if (!this.menuPreview) return;
    this.menuPreviewElapsed += delta;
    this.menuPreviewScale = Math.min(1, this.menuPreviewScale + delta * 3.6);
    this.menuPreview.model.scale.setScalar(0.82 + this.menuPreviewScale * 0.18);
    this.menuPreview.model.rotation.y = Math.sin(this.menuPreviewElapsed * 0.45) * 0.09;
    this.menuPreview.update(delta, 0, false, false, false, false, false, false);
  }

  private positionMenuCamera(): void {
    const mobile = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
    if (mobile) {
      this.camera.position.set(0, 3.4, 19);
      this.camera.lookAt(0, 1.4, 7);
      if (this.menuPreview) {
        this.menuPreview.model.position.set(0, this.world.getSurfaceHeight(0, 7), 7);
      }
      return;
    }
    this.camera.position.set(0, 3.8, 20);
    this.camera.lookAt(0, 1.4, 5);
    if (this.menuPreview) {
      this.menuPreview.model.position.set(4.2, this.world.getSurfaceHeight(4.2, 8), 8);
    }
  }

  private updateGame(delta: number): void {
    const player = this.player!;
    const creatures = this.creatures!;
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.comboWindow = Math.max(0, this.comboWindow - delta);
    if (this.comboWindow === 0) this.comboStep = 0;
    this.respawnTimer = Math.max(0, this.respawnTimer - delta);
    this.autoSaveTimer += delta;
    const look = this.input.takeLookDelta();
    if (this.input.cameraPressed) {
      player.cameraManager.toggle();
      this.ui.toastMessage(`Camera · ${player.cameraManager.mode}`);
    }

    player.blocking = this.blockTouch || this.input.isDown('KeyB');
    const movement = this.input.move();
    const sprinting = this.sprintTouch || this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
    player.update(delta, movement, player.cameraManager.yaw, sprinting, this.input.jumpPressed, look);
    this.input.jumpPressed = false;

    const position = player.model.position;
    creatures.update(
      delta,
      position,
      (damage) => {
        player.takeDamage(damage);
        if (player.health <= 0 && this.respawnTimer === 0) this.handleDeath();
      },
      (creature) => this.rewardCreature(creature),
    );

    this.updatePendingAttack(delta);
    if (this.pendingBossReturn) {
      const message = this.pendingBossReturn;
      this.pendingBossReturn = null;
      this.input.attackPressed = false;
      this.input.interactPressed = false;
      this.input.spiritPressed = false;
      this.input.inventoryPressed = false;
      this.input.cameraPressed = false;
      this.transitionTo('hub');
      this.ui.toastMessage(message);
      return;
    }
    if (this.input.attackPressed) this.performAttack();
    if (this.input.interactPressed) this.interact();
    if (this.input.spiritPressed) this.toggleSpirit();
    if (this.input.inventoryPressed) this.toggleInventory();
    this.input.attackPressed = false;
    this.input.interactPressed = false;
    this.input.spiritPressed = false;
    this.input.inventoryPressed = false;
    this.input.cameraPressed = false;

    this.discoverLandmarks();
    this.updatePrompt();
    this.physics.step();
    const boss = creatures.creatures.find((creature) =>
      creature.bossId && creature.mood !== 'dead' && creature.model.position.distanceTo(position) < 32,
    );
    this.ui.update({
      character: player.character,
      health: player.health,
      stamina: player.stamina,
      mana: player.mana,
      camera: player.cameraManager.mode,
      prompt: this.promptText,
      companion: creatures.companion,
      spiritActive: creatures.spiritActive,
      spiritCooldown: creatures.spiritRemainingCooldown,
      graphicsQuality: this.graphics.quality,
      landmarks: this.world.landmarks.map(({ name, position }) => ({
        name,
        x: position.x,
        z: position.z,
        discovered: player.character.discoveredLocations.includes(name),
      })),
      location: this.world.location,
      tower: player.character.tower,
      boss: boss ? {
        id: boss.bossId ?? 'boss',
        name: boss.bossName ?? 'Boss',
        health: boss.health,
        maxHealth: boss.maxHealth,
        phase: boss.bossPhase,
        visualStatus: boss.visualAnimationStatus,
      } : undefined,
    });
    if (this.autoSaveTimer > 20) {
      this.autoSaveTimer = 0;
      void this.persist();
    }
  }

  private performAttack(): void {
    const player = this.player!;
    if (this.attackCooldown > 0) return;
    const sequence = this.comboWindow > 0 ? (this.comboStep + 1) % 3 : 0;
    this.comboStep = sequence;
    this.comboWindow = 1.15;
    this.attackCooldown = sequence === 2 ? 0.58 : 0.34;
    player.attackAnimation(sequence);
    const forward = new THREE.Vector3(-Math.sin(player.cameraManager.yaw), 0, -Math.cos(player.cameraManager.yaw));
    const target = this.creatures!.creatures
      .filter((creature) => creature.mood !== 'dead' && creature.mood !== 'tamed')
      .map((creature) => ({ creature, offset: creature.model.position.clone().sub(player.model.position) }))
      .filter(({ offset }) => offset.length() <= 2.8 && offset.normalize().dot(forward) > 0.2)
      .sort((a, b) => a.creature.model.position.distanceTo(player.model.position) - b.creature.model.position.distanceTo(player.model.position))[0];
    if (!target) {
      this.ui.toastMessage('Miss · face a creature and strike within range.');
      return;
    }
    const damage = ([16, 20, 28][sequence] + player.attributes.strength * 0.65)
      * getWeaponDamageMultiplier(player.character.equipment);
    this.pendingAttack = {
      target: target.creature,
      damage,
      direction: target.offset.normalize(),
      sequence,
      remaining: [0.24, 0.27, 0.3][sequence],
    };
  }

  private updatePendingAttack(delta: number): void {
    if (!this.pendingAttack) return;
    this.pendingAttack.remaining -= delta;
    if (this.pendingAttack.remaining > 0) return;
    const attack = this.pendingAttack;
    this.pendingAttack = null;
    if (attack.target.mood === 'dead' || attack.target.mood === 'tamed') return;
    attack.target.takeDamage(attack.damage, attack.direction);
    this.spawnHitEffect(
      attack.target.model.position.clone().add(new THREE.Vector3(0, 0.78, 0)),
      attack.sequence,
    );
    this.ui.toastMessage(
      `Combo ${attack.sequence + 1}/3 · ${attack.target.displayName} · ${Math.ceil(attack.damage)} damage`,
    );
  }

  private spawnHitEffect(position: THREE.Vector3, sequence: number): void {
    const count = 9;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const material = new THREE.PointsMaterial({
      color: sequence === 2 ? 0x9fe8ff : sequence === 1 ? 0xff9d55 : 0xffd66b,
      size: sequence === 2 ? 0.2 : 0.16,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material);
    points.position.copy(position);
    points.frustumCulled = false;
    this.world.scene.add(points);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: sequence === 2 ? 0x9fe8ff : sequence === 1 ? 0xff9d55 : 0xffd66b,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 6, 24), ringMaterial);
    ring.position.copy(position);
    ring.quaternion.copy(this.camera.quaternion);
    ring.frustumCulled = false;
    this.world.scene.add(ring);
    const velocities = Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2;
      const speed = 1.2 + (index % 3) * 0.35;
      return new THREE.Vector3(
        Math.cos(angle) * speed,
        0.6 + (index % 3) * 0.35,
        Math.sin(angle) * speed,
      );
    });
    this.hitEffects.push({ points, material, ring, velocities, remaining: 0.32, duration: 0.32 });
  }

  private updateHitEffects(delta: number): void {
    for (let index = this.hitEffects.length - 1; index >= 0; index--) {
      const effect = this.hitEffects[index];
      effect.remaining = Math.max(0, effect.remaining - delta);
      const progress = 1 - effect.remaining / effect.duration;
      const positions = effect.points.geometry.getAttribute('position');
      for (let particle = 0; particle < effect.velocities.length; particle++) {
        const velocity = effect.velocities[particle];
        velocity.y -= delta * 4.5;
        positions.setXYZ(
          particle,
          positions.getX(particle) + velocity.x * delta,
          positions.getY(particle) + velocity.y * delta,
          positions.getZ(particle) + velocity.z * delta,
        );
      }
      positions.needsUpdate = true;
      effect.material.opacity = 0.95 * (1 - progress);
      effect.ring.scale.setScalar(0.65 + progress * 2.1);
      effect.ring.rotation.z = progress * 1.1;
      effect.ring.material.opacity = 0.9 * (1 - progress);
      if (effect.remaining === 0) {
        this.world.scene.remove(effect.points);
        this.world.scene.remove(effect.ring);
        effect.points.geometry.dispose();
        effect.material.dispose();
        effect.ring.geometry.dispose();
        effect.ring.material.dispose();
        this.hitEffects.splice(index, 1);
      }
    }
  }

  private interact(): void {
    const player = this.player!;
    const portal = this.world.portals.find(({ position }) => position.distanceTo(player.model.position) < 3);
    if (portal) {
      if (portal.floor !== null && !player.character.tower.unlockedFloors.includes(portal.floor)) {
        this.ui.toastMessage(`${portal.label} remains sealed · defeat the previous floor boss first.`);
        return;
      }
      this.transitionTo(portal.destination);
      return;
    }
    if (this.creatures!.tameNearest(player.model.position)) {
      player.character.companions = 1;
      player.character.inventory.push('Wolf companion');
      this.ui.toastMessage('The wolf trusts you now. Your companion follows your path.');
      void this.persist();
      return;
    }
    const dropIndex = this.lootDrops.findIndex(({ mesh }) => mesh.position.distanceTo(player.model.position) < 2.7);
    if (dropIndex !== -1) {
      const [drop] = this.lootDrops.splice(dropIndex, 1);
      player.character.inventory.push(drop.item);
      this.world.scene.remove(drop.mesh);
      this.disposeLootDrop(drop.mesh);
      this.ui.toastMessage(`${drop.item} added to your pack.`);
      void this.persist();
      return;
    }
    const location = this.world.landmarks.find((landmark) => landmark.position.distanceTo(player.model.position) < 5);
    if (location) {
      if (!player.character.discoveredLocations.includes(location.name)) {
        player.character.discoveredLocations.push(location.name);
        this.ui.toastMessage(`Discovered · ${location.name}`);
        void this.persist();
      } else {
        this.ui.toastMessage(location.name);
      }
      return;
    }
    this.ui.toastMessage('Nothing nearby answers your call.');
  }

  private toggleSpirit(): void {
    const creatures = this.creatures!;
    if (creatures.spiritActive) {
      creatures.dismissSpirit();
      this.ui.toastMessage('The spirit returns to the unseen realm.');
      return;
    }
    if (creatures.summonSpirit(this.player!.model.position)) {
      this.ui.toastMessage('Spirit of the Wolf · summoned for 18 seconds.');
    } else {
      this.ui.toastMessage(`Spirit recovering · ${Math.ceil(creatures.spiritRemainingCooldown)}s`);
    }
  }

  private rewardCreature(creature: Creature): void {
    if (creature.bossId) {
      void this.completeBoss(creature);
      return;
    }
    let item: string;
    let experience: number;
    if (creature.displayName === 'Gloom Stalker') {
      item = 'Gloom shard';
      experience = 42;
    } else if (creature.displayName === 'Hollow Warden') {
      item = 'Warden iron';
      experience = 58;
    } else if (creature.kind === 'deer') {
      item = 'Deer hide';
      experience = 18;
    } else if (creature.kind === 'wolf') {
      item = 'Wolf pelt';
      experience = 30;
    } else {
      item = 'Bear claw';
      experience = 55;
    }
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 0),
      new THREE.MeshStandardMaterial({ color: 0xd5b76d, emissive: 0x594321, emissiveIntensity: 0.8, roughness: 0.45 }),
    );
    mesh.position.copy(creature.model.position).add(new THREE.Vector3(0, 0.3, 0));
    mesh.castShadow = true;

    this.world.scene.add(mesh);
    this.lootDrops.push({ mesh, item });
    this.addExperience(experience);
    this.ui.toastMessage(`${item} dropped · +${experience} XP · press E to collect`);
    void this.persist();
  }

  private async completeBoss(creature: Creature): Promise<void> {
    const player = this.player;
    const character = player?.character;
    if (!character || !creature.bossId || character.tower.defeatedBosses.includes(creature.bossId)) return;
    character.tower.defeatedBosses.push(creature.bossId);
    if (creature.bossId === 'ancient-wolf') {
      if (!character.tower.unlockedFloors.includes(2)) character.tower.unlockedFloors.push(2);
      if (!character.inventory.includes('Ancient Wolf Sigil')) character.inventory.push('Ancient Wolf Sigil');
      if (!character.inventory.includes('Ornate Sword')) character.inventory.push('Ornate Sword');
    } else if (creature.bossId === 'eternal-phoenix' && !character.tower.unlockedFloors.includes(3)) {
      character.tower.unlockedFloors.push(3);
      character.inventory.push('Phoenix Ember');
    } else if (creature.bossId === 'eternal-dragon') {
      character.inventory.push('Eternal Dragon Heart');
    }
    this.addExperience(300);
    const message = creature.bossId === 'eternal-dragon'
      ? 'Eternal Dragon defeated · the tower is cleared.'
      : creature.bossId === 'ancient-wolf'
        ? 'Ancient Wolf defeated · Floor 2 unlocked · Ornate Sword recovered.'
        : `${creature.bossName} defeated · the next tower portal awakens.`;
    await this.persist();
    if (!this.disposed && this.playing && this.player?.character === character) {
      this.pendingBossReturn = message;
    }
  }

  private addExperience(amount: number): void {
    const character = this.player!.character;
    character.xp += amount;
    let requirement = 100 + (character.level - 1) * 75;
    while (character.xp >= requirement) {
      character.xp -= requirement;
      character.level++;
      character.attributes.health += 12;
      character.attributes.stamina += 8;
      character.attributes.mana += 6;
      character.attributes.strength += 2;
      character.attributes.agility += 1;
      character.attributes.intelligence += 1;
      character.attributes.defense += 1;
      this.player!.health = character.attributes.health;
      this.player!.stamina = character.attributes.stamina;
      this.player!.mana = character.attributes.mana;
      this.ui.toastMessage(`Level ${character.level} reached · attributes increased.`);
      requirement = 100 + (character.level - 1) * 75;
    }
  }

  private handleDeath(): void {
    this.respawnTimer = 3;
    this.player!.health = 0;
    this.ui.toastMessage('You have fallen · returning to the valley in 3 seconds.');
    window.clearTimeout(this.deathTimeout);
    this.deathTimeout = window.setTimeout(() => {
      this.deathTimeout = 0;
      if (!this.playing || !this.player) return;
      this.player.restore(this.world.spawn);
      this.ui.toastMessage('You awaken at the floor entrance.');
    }, 3000);
  }

  private discoverLandmarks(): void {
    const player = this.player!;
    for (const landmark of this.world.landmarks) {
      if (landmark.position.distanceTo(player.model.position) >= 6) continue;
      if (player.character.discoveredLocations.includes(landmark.name)) continue;
      player.character.discoveredLocations.push(landmark.name);
      this.ui.toastMessage(`Discovered · ${landmark.name}`);
      void this.persist();
    }
  }



  private updatePrompt(): void {
    const position = this.player!.model.position;
    const portal = this.world.portals.find(({ position: portalPosition }) => portalPosition.distanceTo(position) < 3);
    if (portal) {

      const locked = portal.floor !== null && !this.player!.character.tower.unlockedFloors.includes(portal.floor);
      this.promptText = locked
        ? `E · ${portal.label} sealed`
        : `E · ${portal.label}`;
      return;
    }
    const wolf = this.creatures!.creatures.find((creature) =>
      creature.kind === 'wolf' && creature.mood === 'hostile' && creature.health <= 24
      && creature.model.position.distanceTo(position) < 3,
    );
    if (wolf) {
      this.promptText = 'E · Tame weakened wolf';
      return;
    }
    const drop = this.lootDrops.find(({ mesh }) => mesh.position.distanceTo(position) < 2.7);
    if (drop) {
      this.promptText = `E · Collect ${drop.item}`;
      return;
    }
    const landmark = this.world.landmarks.find((place) => place.position.distanceTo(position) < 5);
    this.promptText = landmark ? `E · Explore ${landmark.name}` : '';
  }

  private toggleInventory(): void {
    this.ui.toggleInventory();
    this.input.inventoryPressed = false;
  }

  private async equipItem(item: string): Promise<void> {
    const player = this.player;
    if (!player || !player.character.inventory.includes(item)) {
      this.ui.toastMessage('That weapon is not in your pack.');
      return;
    }
    try {
      const equipped = await player.equipWeapon(item);
      if (!equipped || this.player !== player) return;
      player.character.equipment = [item];
      await this.persist();
      this.ui.toastMessage(`${item} equipped.`);
    } catch (error) {
      console.error(`Could not equip "${item}".`, error);
      this.ui.toastMessage(`${item} could not be equipped · the current weapon remains ready.`);
    }
  }

  private transitionTo(location: GameLocation): void {
    if (!this.player) return;
    const character = this.player.character;
    if (location.startsWith('floor')) {
      const floor = Number(location.slice(-1));
      if (!character.tower.unlockedFloors.includes(floor)) {
        this.ui.toastMessage(`Floor ${floor} is locked · defeat the previous floor boss first.`);
        return;
      }
    }
    this.replaceWorld(location);
    character.tower.currentLocation = location;
    this.respawnTimer = 0;
    window.clearTimeout(this.deathTimeout);
    this.deathTimeout = 0;
    this.creatures = new CreatureSystem(
      this.world.scene,
      this.physics,
      this.assets,
      character,
      (x, z) => this.world.getSurfaceHeight(x, z),
      this.world.location,
    );
    this.world.startAmbience();
    this.ui.toastMessage(location === 'hub'
      ? 'The Eternal Sanctuary · safe haven'
      : `Entered ${this.world.location.replace('floor', 'Floor ')}.`);
    void this.persist();
  }

  private replaceWorld(location: GameLocation): void {
    this.creatures?.dispose();
    this.creatures = null;
    this.clearLootDrops();
    this.clearHitEffects();
    this.world.scene.remove(this.camera);
    this.world.dispose();
    this.world = new World(this.assets, this.physics, this.graphics, location);
    this.world.scene.add(this.camera);
    if (this.player) {
      this.player.teleport(this.world.spawn);
      this.world.scene.add(this.player.model);
    }
    this.physics.updateSceneQueries();
  }

  private setGraphicsQuality(quality: GraphicsQuality): void {
    this.graphics = getGraphicsConfig(quality);
    this.renderer.shadowMap.enabled = this.graphics.shadows;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.graphics.maxPixelRatio));
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.assets.setTextureAnisotropy(
      Math.min(this.graphics.textureAnisotropy, this.renderer.capabilities.getMaxAnisotropy()),
    );
    this.world.setGraphicsConfig(this.graphics);
    this.ui.toastMessage(`Graphics quality · ${quality.toUpperCase()}`);
  }

  private async persist(): Promise<void> {
    if (!this.player) return;
    try {
      await this.saves.save(this.player.character);
    } catch (error) {
      console.error('Could not save RED progress.', error);
      if (!this.disposed) this.ui.toastMessage('Save failed · check browser storage permissions.');
    }
  }

  private disposeActors(): void {
    if (this.player) {
      this.world.scene.remove(this.player.model);
      this.player.dispose();
    }
    this.creatures?.dispose();
    this.player = null;
    this.creatures = null;
  }

  private clearLootDrops(): void {
    for (const drop of this.lootDrops) {
      this.world.scene.remove(drop.mesh);
      this.disposeLootDrop(drop.mesh);
    }
    this.lootDrops.length = 0;
  }

  private disposeLootDrop(mesh: THREE.Mesh): void {
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) material.dispose();
  }

  private disposeMenuPreview(): void {
    if (!this.menuPreview) return;
    this.world.scene.remove(this.menuPreview.model);
    disposeActorModel(this.menuPreview.model);
    this.menuPreview = null;
  }

  private resize = (): void => {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (!this.playing && this.world) this.positionMenuCamera();
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.clearTimeout(this.deathTimeout);
    window.removeEventListener('resize', this.resize);
    this.canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
    this.canvas.removeEventListener('contextmenu', this.onCanvasContextMenu);
    this.renderer.setAnimationLoop(null);
    this.disposeActors();
    this.disposeMenuPreview();
    this.clearLootDrops();
    this.clearHitEffects();
    this.world?.scene.remove(this.camera);
    this.world?.dispose();
    this.assets.dispose();
    this.input.dispose();
    this.ui.dispose();
    this.saves.close();
    this.renderer.dispose();
    this.physics?.free();
  }

  private clearHitEffects(): void {
    for (const effect of this.hitEffects) {
      this.world.scene.remove(effect.points);
      this.world.scene.remove(effect.ring);
      effect.points.geometry.dispose();
      effect.material.dispose();
      effect.ring.geometry.dispose();
      effect.ring.material.dispose();
    }
    this.hitEffects.length = 0;
  }
}
