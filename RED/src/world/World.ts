import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { AssetManager } from '../core/AssetManager';
import type { GraphicsConfig } from '../core/GraphicsConfig';
import { WorldEnvironment } from './WorldEnvironment';

export class World {
  readonly scene = new THREE.Scene();
  readonly spawn = new THREE.Vector3(0, 0, 13);
  readonly landmarks = [
    { name: 'Elderwatch Ruins', position: new THREE.Vector3(-15, 0, -13) },
    { name: 'Mossfall Cave', position: new THREE.Vector3(19, 0, -4) },
    { name: 'Whispering River', position: new THREE.Vector3(0, 0, -4) },
    { name: 'Ashen Camp', position: new THREE.Vector3(-29, 0, 17) },
  ];
  private readonly environment: WorldEnvironment;

  constructor(
    assets: AssetManager,
    physics: RAPIER.World,
    graphics: GraphicsConfig,
  ) {
    this.environment = new WorldEnvironment(
      this.scene,
      assets,
      physics,
      graphics,
      [this.spawn, ...this.landmarks.map(({ position }) => position)],
    );
    physics.updateSceneQueries();
    this.spawn.y = this.getSurfaceHeight(this.spawn.x, this.spawn.z);
    this.scene.background = new THREE.Color(0x93a9bd);
    this.scene.fog = new THREE.Fog(0x93a9bd, 52, 158);
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
