import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { AssetManager } from '../core/AssetManager';
import type { GraphicsConfig } from '../core/GraphicsConfig';
import type { GameLocation } from '../core/types';
import { WorldEnvironment } from './WorldEnvironment';

export interface WorldPortal {
  label: string;
  destination: GameLocation;
  floor: number | null;
  position: THREE.Vector3;
}

export class World {
  readonly scene = new THREE.Scene();
  readonly spawn = new THREE.Vector3(0, 0, 13);
  readonly landmarks: Array<{ name: string; position: THREE.Vector3 }>;
  readonly portals: WorldPortal[];
  readonly bossSpawn = new THREE.Vector3(0, 0, -27);
  private readonly environment: WorldEnvironment;

  constructor(
    assets: AssetManager,
    physics: RAPIER.World,
    graphics: GraphicsConfig,
    readonly location: GameLocation = 'floor1',
  ) {
    this.landmarks = location === 'floor1'
      ? [
        { name: 'Elderwatch Ruins', position: new THREE.Vector3(-15, 0, -13) },
        { name: 'Mossfall Cave', position: new THREE.Vector3(19, 0, -4) },
        { name: 'Whispering River', position: new THREE.Vector3(0, 0, -4) },
        { name: 'Ashen Camp', position: new THREE.Vector3(-29, 0, 17) },
      ]
      : [];
    if (location === 'hub') this.spawn.set(0, 0, 13);
    this.portals = location === 'hub'
      ? [
        { label: 'Forsaken Wilds', destination: 'floor1', floor: 1, position: new THREE.Vector3(-8, 0, -5) },
        { label: 'Ashen Sanctuary', destination: 'floor2', floor: 2, position: new THREE.Vector3(0, 0, -5) },
        { label: "Dragon's Throne", destination: 'floor3', floor: 3, position: new THREE.Vector3(8, 0, -5) },
      ]
      : [{ label: 'Eternal Sanctuary', destination: 'hub', floor: null, position: new THREE.Vector3(0, 0, 7) }];
    const activeLandmarks = location === 'floor1' ? this.landmarks : [];
    const anchors = [this.spawn, this.bossSpawn, ...this.portals.map(({ position }) => position),
      ...activeLandmarks.map(({ position }) => position)];
    this.environment = new WorldEnvironment(
      this.scene,
      assets,
      physics,
      graphics,
      anchors,
      location,
    );
    physics.updateSceneQueries();
    this.spawn.y = this.getSurfaceHeight(this.spawn.x, this.spawn.z);
    this.bossSpawn.y = this.getSurfaceHeight(this.bossSpawn.x, this.bossSpawn.z);
    this.scene.background = new THREE.Color(location === 'floor2' ? 0x352c2b : location === 'floor3' ? 0x45515b : 0x52616e);
    this.scene.fog = new THREE.Fog(
      location === 'floor2' ? 0x4a3834 : location === 'floor3' ? 0x3e4a55 : 0x52616e,
      location === 'floor2' ? 24 : 42,
      location === 'floor2' ? 96 : 148,
    );
  }

  getSurfaceHeight(x: number, z: number): number {
    return this.environment.getSurfaceHeight(x, z);
  }

  update(delta: number): void {
    this.environment.update(delta);
  }

  startAmbience(): void {
    this.environment.startAmbience();
  }

  setGraphicsConfig(graphics: GraphicsConfig): void {
    this.environment.setGraphicsConfig(graphics);
  }

  dispose(): void {
    this.environment.dispose();
  }
}
