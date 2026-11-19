import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { AssetManager } from '../core/AssetManager';
import type { GraphicsConfig } from '../core/GraphicsConfig';
import { AmbientAudio } from './AmbientAudio';

interface InstanceSpec {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  color?: THREE.Color;
}

interface PathDefinition {
  curve: THREE.CatmullRomCurve3;
  width: number;
}

const WORLD_SIZE = 120;
const HALF_WORLD = WORLD_SIZE / 2;
const TERRAIN_SEGMENTS = 144;
const CHUNK_SIZE = 40;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function randomGenerator(initialSeed: number): () => number {
  let seed = initialSeed;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function chunkKey(x: number, z: number): string {
  const column = Math.floor((x + HALF_WORLD) / CHUNK_SIZE);
  const row = Math.floor((z + HALF_WORLD) / CHUNK_SIZE);
  return `${column},${row}`;
}

function createCanopyGeometry(type: 'pine' | 'broadleaf', detail: number): THREE.BufferGeometry {
  const geometry = type === 'pine'
    ? new THREE.ConeGeometry(1, 1, detail === 0 ? 12 : 24, detail === 0 ? 7 : 16)
    : new THREE.IcosahedronGeometry(1, detail);
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const angle = Math.atan2(z, x);
    const radialVariation = Math.sin(angle * 7 + y * 17) * 0.045
      + Math.sin(angle * 13 - y * 23) * 0.025
      + Math.sin(x * 19 + z * 17 + y * 11) * 0.018;
    if (type === 'pine') {
      const tierVariation = Math.sin((y + 0.5) * Math.PI * 9 + Math.sin(angle * 5) * 0.45) * 0.055;
      const sourceRadius = Math.hypot(x, z);
      const radius = sourceRadius * (1 + radialVariation + tierVariation);
      if (sourceRadius > 0) {
        positions.setX(index, (x / sourceRadius) * radius);
        positions.setZ(index, (z / sourceRadius) * radius);
      }
    } else {
      const radius = 1 + radialVariation;
      positions.setXYZ(index, x * radius, y * radius, z * radius);
    }
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createTrunkGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(0.055, 0.2, 1, 12, 8);
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index++) {
    const y = positions.getY(index) + 0.5;
    positions.setX(index, positions.getX(index) + Math.sin(y * Math.PI * 1.4) * y * 0.025);
    positions.setZ(index, positions.getZ(index) + Math.sin(y * Math.PI * 2.1) * y * 0.018);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export class WorldEnvironment {
  private readonly colliders: RAPIER.RigidBody[] = [];
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly textures = new Set<THREE.Texture>();
  private readonly windUniforms: Array<{ value: number }> = [];
  private readonly curvePoints = new Map<THREE.CatmullRomCurve3, THREE.Vector3[]>();
  private readonly riverCurve: THREE.CatmullRomCurve3;
  private readonly paths: PathDefinition[];
  private readonly audio = new AmbientAudio();
  private disposed = false;
  private terrainTexture!: THREE.DataTexture;
  private particles!: THREE.Points;
  private sun!: THREE.DirectionalLight;
  private hemisphere!: THREE.HemisphereLight;
  private elapsed = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly assets: AssetManager,
    private readonly physics: RAPIER.World,
    private graphics: GraphicsConfig,
    private readonly anchors: THREE.Vector3[],
  ) {
    this.riverCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-31, 0, -4),
      new THREE.Vector3(-21, 0, -9),
      new THREE.Vector3(-10, 0, -5),
      new THREE.Vector3(1, 0, -8),
      new THREE.Vector3(12, 0, -3),
      new THREE.Vector3(31, 0, -7),
    ]);
    this.paths = [
      {
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 14),
          new THREE.Vector3(-3, 0, 8),
          new THREE.Vector3(-7, 0, 1),
          new THREE.Vector3(-10, 0, -7),
          new THREE.Vector3(-15, 0, -13),
        ]),
        width: 2.6,
      },
      {
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(-15, 0, -13),
          new THREE.Vector3(-7, 0, -14),
          new THREE.Vector3(3, 0, -11),
          new THREE.Vector3(11, 0, -7),
          new THREE.Vector3(19, 0, -4),
        ]),
        width: 2.3,
      },
      {
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 14),
          new THREE.Vector3(-9, 0, 17),
          new THREE.Vector3(-19, 0, 19),
          new THREE.Vector3(-29, 0, 17),
        ]),
        width: 2.1,
      },
    ];
    this.curvePoints.set(this.riverCurve, this.riverCurve.getPoints(64));
    for (const { curve } of this.paths) this.curvePoints.set(curve, curve.getPoints(64));

    this.buildTerrain();
    this.buildPaths();
    this.buildRiver();
    this.buildMountains();
    this.buildForest();
    this.buildRuin();
    this.buildCave();
    this.buildAbandonedCamp();
    this.buildLighting();
    this.buildParticles();
    for (const anchor of this.anchors) anchor.y = this.getSurfaceHeight(anchor.x, anchor.z);
  }

  getSurfaceHeight(x: number, z: number): number {
    const radius = Math.hypot(x, z);
    const foothills = Math.pow(Math.max(0, radius - 30), 1.2) * 0.09;
    const undulation = (
      Math.sin(x * 0.19 + z * 0.08) * 0.3
      + Math.cos(z * 0.17 - x * 0.11) * 0.23
      + Math.sin((x + z) * 0.31) * 0.1
    ) * smoothstep(7, 32, radius);
    const ridge = (
      7.5 * Math.exp(-(((x + 42) / 12) ** 2 + ((z + 14) / 20) ** 2))
      + 8.5 * Math.exp(-(((x - 37) / 14) ** 2 + ((z + 34) / 16) ** 2))
      + 6.5 * Math.exp(-(((x + 39) / 15) ** 2 + ((z - 34) / 17) ** 2))
      + 7 * Math.exp(-(((x - 14) / 18) ** 2 + ((z - 45) / 12) ** 2))
    );
    const clearing = Math.max(
      Math.exp(-(x ** 2 + (z - 13) ** 2) / 225),
      Math.exp(-((x + 15) ** 2 + (z + 13) ** 2) / 121),
      Math.exp(-((x - 19) ** 2 + (z + 4) ** 2) / 81),
      Math.exp(-((x + 29) ** 2 + (z - 17) ** 2) / 64),
    );
    const riverCut = Math.exp(-((this.distanceToCurve(x, z, this.riverCurve, 36) / 2.9) ** 2)) * 0.34;
    return (foothills + undulation + ridge) * (1 - clearing) - riverCut;
  }

  update(delta: number): void {
    this.elapsed += delta;
    for (const uniform of this.windUniforms) uniform.value = this.elapsed;

    const positions = this.particles.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      let x = positions.getX(i) + Math.sin(this.elapsed * 0.27 + i) * delta * 0.2;
      let y = positions.getY(i) + delta * (0.03 + (i % 5) * 0.008);
      let z = positions.getZ(i) + Math.cos(this.elapsed * 0.21 + i * 0.7) * delta * 0.17;
      if (y > 8) y = this.getSurfaceHeight(x, z) + (i % 6) * 0.3;
      if (x > 55) x = -55;
      else if (x < -55) x = 55;
      if (z > 55) z = -55;
      else if (z < -55) z = 55;
      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;

    const daylight = 0.5 + 0.5 * Math.sin(this.elapsed * 0.018 - 0.7);
    this.sun.color.setRGB(1, 0.83 + daylight * 0.11, 0.68 + daylight * 0.24);
    this.sun.intensity = this.graphics.directionalLightIntensity * (0.84 + daylight * 0.16);
  }

  startAmbience(): void {
    this.audio.start();
  }

  setGraphicsConfig(graphics: GraphicsConfig): void {
    this.graphics = graphics;
    this.hemisphere.intensity = graphics.hemisphereLightIntensity;
    this.sun.castShadow = graphics.shadows;
    this.sun.shadow.mapSize.set(graphics.shadowMapSize, graphics.shadowMapSize);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.sun.shadow.needsUpdate = true;
    this.terrainTexture.anisotropy = graphics.textureAnisotropy;
  }

  private buildTerrain(): void {
    const side = TERRAIN_SEGMENTS + 1;
    const positions = new Float32Array(side * side * 3);
    const colors = new Float32Array(side * side * 3);
    const uvs = new Float32Array(side * side * 2);
    const heights = new Float32Array(side * side);
    const indices = new Uint32Array(TERRAIN_SEGMENTS * TERRAIN_SEGMENTS * 6);
    const grassColor = new THREE.Color(0x94a878);
    const dirtColor = new THREE.Color(0xb78b5d);
    const rockColor = new THREE.Color(0x828d99);
    const blendedColor = new THREE.Color();
    const gridSpacing = WORLD_SIZE / TERRAIN_SEGMENTS;
    let vertex = 0;
    let index = 0;

    for (let row = 0; row <= TERRAIN_SEGMENTS; row++) {
      const z = -HALF_WORLD + row * gridSpacing;
      for (let column = 0; column <= TERRAIN_SEGMENTS; column++) {
        const x = -HALF_WORLD + column * gridSpacing;
        heights[row * side + column] = this.getSurfaceHeight(x, z);
      }
    }

    for (let row = 0; row <= TERRAIN_SEGMENTS; row++) {
      const z = -HALF_WORLD + row * gridSpacing;
      for (let column = 0; column <= TERRAIN_SEGMENTS; column++) {
        const x = -HALF_WORLD + column * gridSpacing;
        const y = heights[vertex];
        positions[vertex * 3] = x;
        positions[vertex * 3 + 1] = y;
        positions[vertex * 3 + 2] = z;
        uvs[vertex * 2] = x / 7;
        uvs[vertex * 2 + 1] = z / 7;

        let pathDistance = Number.POSITIVE_INFINITY;
        for (const path of this.paths) {
          const distance = this.distanceToCurve(x, z, path.curve, 44);
          if (distance < pathDistance) pathDistance = distance;
        }
        const riverDistance = this.distanceToCurve(x, z, this.riverCurve, 32);
        const pathBlend = 1 - smoothstep(0.7, 2.15, pathDistance);
        const bankBlend = (1 - smoothstep(2.2, 4.2, riverDistance)) * 0.72;
        const left = heights[row * side + Math.max(0, column - 1)];
        const right = heights[row * side + Math.min(TERRAIN_SEGMENTS, column + 1)];
        const above = heights[Math.max(0, row - 1) * side + column];
        const below = heights[Math.min(TERRAIN_SEGMENTS, row + 1) * side + column];
        const slopeX = column === 0
          ? (right - y) / gridSpacing
          : column === TERRAIN_SEGMENTS
            ? (y - left) / gridSpacing
            : (right - left) / (2 * gridSpacing);
        const slopeZ = row === 0
          ? (below - y) / gridSpacing
          : row === TERRAIN_SEGMENTS
            ? (y - above) / gridSpacing
            : (below - above) / (2 * gridSpacing);
        const slope = Math.hypot(slopeX, slopeZ);
        const exposedStone = Math.max(smoothstep(4, 14, y) * 0.65, smoothstep(0.28, 0.95, slope) * 0.86);
        blendedColor.copy(grassColor).lerp(dirtColor, Math.max(pathBlend, bankBlend));
        blendedColor.lerp(rockColor, exposedStone);
        colors[vertex * 3] = blendedColor.r;
        colors[vertex * 3 + 1] = blendedColor.g;
        colors[vertex * 3 + 2] = blendedColor.b;
        vertex++;

        if (row < TERRAIN_SEGMENTS && column < TERRAIN_SEGMENTS) {
          const a = row * side + column;
          const b = a + 1;
          const c = a + side;
          const d = c + 1;
          indices[index++] = a;
          indices[index++] = c;
          indices[index++] = b;
          indices[index++] = b;
          indices[index++] = c;
          indices[index++] = d;
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    this.geometries.add(geometry);

    const texture = this.createGroundTexture();
    this.terrainTexture = texture;
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      vertexColors: true,
      roughness: 1,
      metalness: 0,
    });
    this.materials.add(material);
    void this.applyForestGroundMaterial(material);
    const terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    terrain.frustumCulled = false;
    this.scene.add(terrain);

    const body = this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.physics.createCollider(
      RAPIER.ColliderDesc.trimesh(positions, indices).setFriction(1.1),
      body,
    );
    this.colliders.push(body);

    this.buildWorldBoundaries();
  }

  private async applyForestGroundMaterial(material: THREE.MeshStandardMaterial): Promise<void> {
    const pbr = await this.assets.createPBRMaterial({
      roughness: 1,
      metalness: 0,
      baseColorMap: 'assets/terrain/forest_ground_04_diff_1k.jpg',
      normalMap: 'assets/terrain/forest_ground_04_nor_gl_1k.jpg',
      roughnessMap: 'assets/terrain/forest_ground_04_rough_1k.jpg',
    });
    if (this.disposed) return;

    material.map = pbr.map ?? material.map;
    material.normalMap = pbr.normalMap;
    material.roughnessMap = pbr.roughnessMap;
    material.normalScale.set(0.65, 0.65);
    for (const texture of [material.map, material.normalMap, material.roughnessMap]) {
      if (!texture) continue;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.needsUpdate = true;
    }
    material.needsUpdate = true;
  }

  private createGroundTexture(): THREE.DataTexture {
    const size = 256;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / size) * Math.PI * 2;
        const v = (y / size) * Math.PI * 2;
        const broad = Math.sin(u * 2.1 + Math.sin(v * 1.3)) * 6
          + Math.cos(v * 2.4 + Math.sin(u * 1.7)) * 4;
        const fine = Math.sin(u * 5.3 + Math.cos(v * 3.1)) * 2
          + Math.cos(v * 6.4 - Math.sin(u * 4.2)) * 1.2;
        const fleck = Math.sin(u * 11.2 + Math.cos(v * 8.6)) * 0.8;
        const offset = (y * size + x) * 4;
        pixels[offset] = 116 + broad + fine + fleck;
        pixels[offset + 1] = 119 + broad * 1.12 + fine * 0.92 + fleck;
        pixels[offset + 2] = 88 + broad * 0.64 + fine * 0.75 + fleck;
        pixels[offset + 3] = 255;
      }
    }
    const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = Math.min(this.graphics.textureAnisotropy, 8);
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    this.textures.add(texture);
    return texture;
  }

  private buildWorldBoundaries(): void {
    const wallHeight = 38;
    const wallThickness = 2;
    for (const [x, z, width, depth] of [
      [0, -HALF_WORLD, WORLD_SIZE, wallThickness],
      [0, HALF_WORLD, WORLD_SIZE, wallThickness],
      [-HALF_WORLD, 0, wallThickness, WORLD_SIZE],
      [HALF_WORLD, 0, wallThickness, WORLD_SIZE],
    ]) {
      const body = this.physics.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(x, wallHeight / 2 - 3, z),
      );
      this.physics.createCollider(
        RAPIER.ColliderDesc.cuboid(width / 2, wallHeight / 2, depth / 2),
        body,
      );
      this.colliders.push(body);
    }
  }

  private buildPaths(): void {
    for (const { curve, width } of this.paths) {
      const steps = 130;
      const positions = new Float32Array((steps + 1) * 2 * 3);
      const uvs = new Float32Array((steps + 1) * 2 * 2);
      const indices = new Uint32Array(steps * 6);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t).setY(0).normalize();
        const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
        const edgeNoise = 0.91 + Math.sin(t * 67) * 0.045 + Math.sin(t * 131) * 0.035;
        for (let edge = 0; edge < 2; edge++) {
          const direction = edge === 0 ? -1 : 1;
          const x = point.x + side.x * width * 0.5 * edgeNoise * direction;
          const z = point.z + side.z * width * 0.5 * edgeNoise * direction;
          const offset = (i * 2 + edge) * 3;
          positions[offset] = x;
          positions[offset + 1] = this.getSurfaceHeight(x, z) + 0.035;
          positions[offset + 2] = z;
          uvs[(i * 2 + edge) * 2] = edge;
          uvs[(i * 2 + edge) * 2 + 1] = t * 22;
        }
        if (i < steps) {
          const a = i * 2;
          const b = a + 1;
          const c = a + 2;
          const d = a + 3;
          const offset = i * 6;
          indices.set([a, b, c, b, d, c], offset);
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeVertexNormals();
      this.geometries.add(geometry);
      const path = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: 0xb7a078,
          map: this.terrainTexture,
          roughness: 1,
          side: THREE.DoubleSide,
        }),
      );
      this.materials.add(path.material);
      path.receiveShadow = true;
      this.scene.add(path);
    }
  }

  private buildRiver(): void {
    const bankCurve = this.curveFollowingGround(this.riverCurve, 0.015);
    const waterCurve = this.curveFollowingGround(this.riverCurve, 0.34);
    const water = new THREE.Mesh(
      new THREE.TubeGeometry(waterCurve, 160, 1.34, 10, false),
      new THREE.MeshStandardMaterial({
        color: 0x9ac4b4,
        roughness: 0.2,
        metalness: 0.12,
        transparent: true,
        opacity: 0.84,
        depthWrite: false,
      }),
    );
    water.castShadow = false;
    water.receiveShadow = true;
    water.renderOrder = 1;
    this.trackObject(water);
    this.scene.add(water);

    const bank = new THREE.Mesh(
      new THREE.TubeGeometry(bankCurve, 160, 2.15, 8, false),
      new THREE.MeshStandardMaterial({ color: 0x857754, roughness: 1 }),
    );
    bank.scale.y = 0.11;
    bank.position.y -= 0.045;
    bank.receiveShadow = true;
    this.trackObject(bank);
    this.scene.add(bank);

    const shorelineMat = new THREE.MeshStandardMaterial({ color: 0x667454, roughness: 1 });
    this.materials.add(shorelineMat);
    for (let i = 0; i < 32; i++) {
      const point = this.riverCurve.getPointAt((i + 0.5) / 32);
      const side = i % 2 === 0 ? 1 : -1;
      const x = point.x + side * (2.4 + (i % 3) * 0.45);
      const z = point.z + Math.sin(i * 4.1) * 1.1;
      const reed = new THREE.Mesh(
        new THREE.ConeGeometry(0.055, 0.8 + (i % 4) * 0.12, 4),
        shorelineMat,
      );
      reed.position.set(x, this.getSurfaceHeight(x, z) + 0.42, z);
      reed.rotation.z = Math.sin(i) * 0.14;
      reed.castShadow = false;
      this.trackObject(reed);
      this.scene.add(reed);
    }
  }

  private curveFollowingGround(curve: THREE.CatmullRomCurve3, heightOffset: number): THREE.CatmullRomCurve3 {
    const points = curve.getPoints(32).map((point) =>
      new THREE.Vector3(point.x, this.getSurfaceHeight(point.x, point.z) + heightOffset, point.z));
    return new THREE.CatmullRomCurve3(points);
  }

  private buildMountains(): void {
    const random = randomGenerator(45321);
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2 + (random() - 0.5) * 0.12;
      const radius = 48 + random() * 8;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const geometry = new THREE.IcosahedronGeometry(1, 2);
      const position = geometry.getAttribute('position');
      const colors: number[] = [];
      for (let vertex = 0; vertex < position.count; vertex++) {
        const px = position.getX(vertex);
        const py = position.getY(vertex);
        const pz = position.getZ(vertex);
        const noise = Math.sin(px * 7.1 + pz * 11.7 + i) * 0.065
          + Math.cos(py * 12.3 - px * 8.2) * 0.035;
        position.setXYZ(vertex, px * (1 + noise), py * (1 + noise), pz * (1 + noise));
        const heightTint = smoothstep(-0.15, 0.72, py + noise);
        const stone = new THREE.Color(0x68776e);
        const summit = new THREE.Color(0xb1b5a8);
        stone.lerp(summit, heightTint * 0.74);
        colors.push(stone.r, stone.g, stone.b);
      }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      this.geometries.add(geometry);
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.28 + random() * 0.04, 0.12, 0.9),
        vertexColors: true,
        flatShading: true,
        roughness: 1,
      });
      this.materials.add(material);
      const height = 18 + random() * 13;
      const mountain = new THREE.Mesh(geometry, material);
      mountain.position.set(x, this.getSurfaceHeight(x, z) + height * 0.33, z);
      mountain.scale.set(10 + random() * 9, height, 12 + random() * 9);
      mountain.rotation.y = random() * Math.PI;
      mountain.castShadow = true;
      mountain.receiveShadow = true;
      this.scene.add(mountain);
    }

    const skyGeometry = new THREE.SphereGeometry(280, 24, 16);
    const skyColors: number[] = [];
    const skyPosition = skyGeometry.getAttribute('position');
    for (let i = 0; i < skyPosition.count; i++) {
      const height = smoothstep(-0.04, 0.72, skyPosition.getY(i) / 280);
      const color = new THREE.Color(0x93a9bd).lerp(new THREE.Color(0x657f9a), height * 0.82);
      skyColors.push(color.r, color.g, color.b);
    }
    skyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
    this.geometries.add(skyGeometry);
    const skyMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.materials.add(skyMaterial);
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    sky.frustumCulled = false;
    this.scene.add(sky);
  }

  private buildForest(): void {
    const random = randomGenerator(93751);
    const trunkGeometry = createTrunkGeometry();
    const pineGeometry = createCanopyGeometry('pine', 1);
    const leafGeometry = createCanopyGeometry('broadleaf', 3);
    const pineLodGeometry = createCanopyGeometry('pine', 0);
    const leafLodGeometry = createCanopyGeometry('broadleaf', 1);
    const bushGeometry = new THREE.IcosahedronGeometry(1, 1);
    const fernGeometry = new THREE.ConeGeometry(0.12, 0.78, 4);
    const grassGeometry = new THREE.ConeGeometry(0.075, 0.52, 4);
    const rockGeometry = new THREE.DodecahedronGeometry(1, 1);
    const flowerGeometry = new THREE.IcosahedronGeometry(0.075, 1);
    for (const geometry of [
      trunkGeometry, pineGeometry, leafGeometry, pineLodGeometry, leafLodGeometry, bushGeometry,
      fernGeometry, grassGeometry, rockGeometry, flowerGeometry,
    ]) this.geometries.add(geometry);

    const bark = this.assets.materials.bark;
    const pineDark = this.createWindMaterial(this.assets.materials.leaves);
    const pineLight = this.createWindMaterial(this.assets.materials.leavesLight);
    const fernMaterial = this.createWindMaterial(this.assets.materials.leavesLight);
    const grassMaterial = this.createWindMaterial(this.assets.materials.grass);
    const batches = new Map<string, Map<string, InstanceSpec[]>>();
    const add = (kind: string, x: number, z: number, spec: InstanceSpec): void => {
      const key = chunkKey(x, z);
      let chunk = batches.get(kind);
      if (!chunk) {
        chunk = new Map();
        batches.set(kind, chunk);
      }
      const instances = chunk.get(key);
      if (instances) instances.push(spec);
      else chunk.set(key, [spec]);
    };

    for (let i = 0; i < 210; i++) {
      const clusterAngle = random() * Math.PI * 2;
      const clusterRadius = 27 + random() * 23;
      const x = Math.cos(clusterAngle) * clusterRadius + (random() - 0.5) * 14;
      const z = Math.sin(clusterAngle) * clusterRadius + (random() - 0.5) * 14;
      if (!this.isVegetationLocation(x, z, 2.6)) continue;
      const ground = this.getSurfaceHeight(x, z);
      const size = 0.82 + random() * 0.54;
      const yaw = random() * Math.PI * 2;
      const rotation = new THREE.Euler((random() - 0.5) * 0.06, yaw, (random() - 0.5) * 0.06);
      const distanceFromValley = Math.hypot(x, z);
      const isDistant = distanceFromValley > 42;
      const isDeciduous = distanceFromValley < 40 && random() < 0.27;
      add('trunk', x, z, {
        position: new THREE.Vector3(x, ground + (isDeciduous ? 1.65 : 1.85) * size, z),
        rotation,
        scale: new THREE.Vector3(0.16 * size, (isDeciduous ? 3.3 : 3.7) * size, 0.16 * size),
      });
      if (i % 3 === 0) this.addTrunkCollider(x, ground, z, size);
      if (isDeciduous) {
        const crowns = isDistant
          ? [[0, 2.85, 0, 1.85]]
          : [
              [-0.62, 2.65, 0, 1.28],
              [0.55, 2.75, 0.28, 1.12],
              [0, 3.22, -0.35, 1.1],
              [0.05, 2.45, 0.55, 0.9],
            ];
        for (const [offsetX, offsetY, offsetZ, crownSize] of crowns) {
          const crownMaterial = random() < 0.38 ? 'leafLight' : 'leafDark';
          add(isDistant ? 'leafLod' : crownMaterial, x, z, {
            position: new THREE.Vector3(x + offsetX * size, ground + offsetY * size, z + offsetZ * size),
            rotation: new THREE.Euler(0, yaw, 0),
            scale: new THREE.Vector3(crownSize * size, crownSize * size * 0.9, crownSize * size),
            color: new THREE.Color().setHSL(0.27 + random() * 0.04, 0.28, 0.38 + random() * 0.08),
          });
        }
      } else {
        const keys = isDistant ? ['pineLod'] : ['pineDark', 'pineLight', 'pineDark'];
        const tiers = isDistant
          ? [[2.55, 1.28, 4.2]]
          : [
              [1.65, 1.35, 2.15],
              [2.65, 1.08, 1.9],
              [3.55, 0.78, 1.62],
            ];
        tiers.forEach(([height, radius, tierHeight], tier) => {
          add(keys[tier], x, z, {
            position: new THREE.Vector3(x, ground + height * size, z),
            rotation: new THREE.Euler(0, yaw, 0),
            scale: new THREE.Vector3(radius * size, tierHeight * size, radius * size),
            color: new THREE.Color().setHSL(0.31 + random() * 0.035, 0.3, 0.3 + random() * 0.1),
          });
        });
      }
    }

    this.addChunkedInstances(batches.get('trunk'), trunkGeometry, bark, true, true);
    this.addChunkedInstances(batches.get('pineDark'), pineGeometry, pineDark, true, true);
    this.addChunkedInstances(batches.get('pineLight'), pineGeometry, pineLight, true, true);
    this.addChunkedInstances(batches.get('leafDark'), leafGeometry, pineDark, true, true);
    this.addChunkedInstances(batches.get('leafLight'), leafGeometry, pineLight, true, true);
    this.addChunkedInstances(batches.get('pineLod'), pineLodGeometry, pineDark, true, true);
    this.addChunkedInstances(batches.get('leafLod'), leafLodGeometry, pineLight, true, true);

    const shrubBatches = new Map<string, InstanceSpec[]>();
    for (let i = 0; i < 250; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 16 + random() * 35;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (!this.isVegetationLocation(x, z, 1.9)) continue;
      const ground = this.getSurfaceHeight(x, z);
      for (let lobe = 0; lobe < 3; lobe++) {
        const px = x + (random() - 0.5) * 0.8;
        const pz = z + (random() - 0.5) * 0.8;
        const specs = shrubBatches.get(chunkKey(x, z)) ?? [];
        specs.push({
          position: new THREE.Vector3(px, ground + 0.22 + random() * 0.12, pz),
          rotation: new THREE.Euler(random() * 0.2, random() * Math.PI, 0),
          scale: new THREE.Vector3(0.45 + random() * 0.34, 0.38 + random() * 0.28, 0.42 + random() * 0.36),
          color: new THREE.Color().setHSL(0.28 + random() * 0.06, 0.32, 0.31 + random() * 0.12),
        });
        shrubBatches.set(chunkKey(x, z), specs);
      }
    }
    this.addChunkedInstancesByKey(shrubBatches, bushGeometry, pineDark, false, true);

    const fernBatches = new Map<string, InstanceSpec[]>();
    const grassBatches = new Map<string, InstanceSpec[]>();
    const flowerBatches = new Map<string, InstanceSpec[]>();
    for (let i = 0; i < 330; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 12 + random() * 39;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (!this.isVegetationLocation(x, z, 0.8)) continue;
      const ground = this.getSurfaceHeight(x, z);
      const key = chunkKey(x, z);
      if (i % 3 === 0) {
        const specs = fernBatches.get(key) ?? [];
        for (let blade = 0; blade < 6; blade++) {
          const yaw = random() * Math.PI * 2;
          specs.push({
            position: new THREE.Vector3(x + Math.cos(yaw) * 0.12, ground + 0.36, z + Math.sin(yaw) * 0.12),
            rotation: new THREE.Euler((random() - 0.5) * 0.5, yaw, (random() - 0.5) * 0.5),
            scale: new THREE.Vector3(0.7 + random() * 0.6, 0.7 + random() * 0.6, 0.7 + random() * 0.6),
            color: new THREE.Color().setHSL(0.29 + random() * 0.06, 0.38, 0.36 + random() * 0.12),
          });
        }
        fernBatches.set(key, specs);
      } else {
        const specs = grassBatches.get(key) ?? [];
        for (let blade = 0; blade < 7; blade++) {
          const yaw = random() * Math.PI * 2;
          specs.push({
            position: new THREE.Vector3(x + Math.cos(yaw) * random() * 0.35, ground + 0.22, z + Math.sin(yaw) * random() * 0.35),
            rotation: new THREE.Euler((random() - 0.5) * 0.45, yaw, (random() - 0.5) * 0.45),
            scale: new THREE.Vector3(0.65 + random() * 0.8, 0.55 + random() * 1.1, 0.65 + random() * 0.8),
            color: new THREE.Color().setHSL(0.25 + random() * 0.11, 0.35, 0.35 + random() * 0.16),
          });
        }
        grassBatches.set(key, specs);
      }
      if (i % 11 === 0) {
        const flowers = flowerBatches.get(key) ?? [];
        for (let bloom = 0; bloom < 3; bloom++) {
          const hue = [0.12, 0.83, 0.98][bloom];
          flowers.push({
            position: new THREE.Vector3(x + (random() - 0.5) * 0.45, ground + 0.22, z + (random() - 0.5) * 0.45),
            rotation: new THREE.Euler(0, random() * Math.PI, 0),
            scale: new THREE.Vector3(1, 1, 1),
            color: new THREE.Color().setHSL(hue, 0.55, 0.72),
          });
        }
        flowerBatches.set(key, flowers);
      }
    }
    this.addChunkedInstancesByKey(fernBatches, fernGeometry, fernMaterial, false, false);
    this.addChunkedInstancesByKey(grassBatches, grassGeometry, grassMaterial, false, false);
    const flowerMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    this.materials.add(flowerMaterial);
    this.addChunkedInstancesByKey(flowerBatches, flowerGeometry, flowerMaterial, false, false);

    const rockBatches = new Map<string, InstanceSpec[]>();
    for (let i = 0; i < 145; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 17 + random() * 37;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (!this.isVegetationLocation(x, z, 1.2)) continue;
      const size = 0.24 + random() * 0.95;
      const specs = rockBatches.get(chunkKey(x, z)) ?? [];
      specs.push({
        position: new THREE.Vector3(x, this.getSurfaceHeight(x, z) + size * 0.28, z),
        rotation: new THREE.Euler(random() * 0.4, random() * Math.PI, random() * 0.35),
        scale: new THREE.Vector3(size * 1.2, size * 0.72, size),
        color: new THREE.Color().setHSL(0.13 + random() * 0.06, 0.08, 0.53 + random() * 0.16),
      });
      rockBatches.set(chunkKey(x, z), specs);
    }
    this.addChunkedInstancesByKey(rockBatches, rockGeometry, this.assets.materials.stone, true, true);
    this.addFallenLogs(random);
  }

  private addFallenLogs(random: () => number): void {
    const logGeometry = new THREE.CylinderGeometry(0.16, 0.22, 3.1, 9);
    const logMaterial = this.assets.materials.bark.clone();
    logMaterial.color.setHex(0x594734);
    this.geometries.add(logGeometry);
    this.materials.add(logMaterial);
    for (let i = 0; i < 13; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 20 + random() * 25;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (!this.isVegetationLocation(x, z, 2)) continue;
      const log = new THREE.Mesh(logGeometry, logMaterial);
      log.position.set(x, this.getSurfaceHeight(x, z) + 0.19, z);
      log.rotation.set(Math.PI / 2 + (random() - 0.5) * 0.12, random() * Math.PI, 0);
      log.castShadow = true;
      log.receiveShadow = true;
      this.scene.add(log);
    }
  }

  private isVegetationLocation(x: number, z: number, margin: number): boolean {
    if (Math.hypot(x, z - 13) < 7 + margin) return false;
    if (Math.hypot(x + 15, z + 13) < 8 + margin) return false;
    if (Math.hypot(x - 19, z + 4) < 8 + margin) return false;
    if (Math.hypot(x + 29, z - 17) < 7 + margin) return false;
    if (this.distanceToCurve(x, z, this.riverCurve, 36) < 4.3 + margin) return false;
    return this.paths.every(({ curve, width }) =>
      this.distanceToCurve(x, z, curve, 36) > width * 0.5 + margin);
  }

  private createWindMaterial(source: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
    const material = source.clone();
    const timeUniform = { value: 0 };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWorldWindTime = timeUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uWorldWindTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float windPhase = uWorldWindTime + instanceMatrix[3][0] * 0.13 + instanceMatrix[3][2] * 0.11;
            transformed.x += sin(windPhase + transformed.y * 1.8) * max(transformed.y + 0.5, 0.0) * 0.055;
          #endif`,
        );
    };
    material.customProgramCacheKey = () => 'red-valley-instanced-wind-v1';
    this.materials.add(material);
    this.windUniforms.push(timeUniform);
    return material;
  }

  private addChunkedInstances(
    chunks: Map<string, InstanceSpec[]> | undefined,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    castShadow: boolean,
    receiveShadow: boolean,
  ): void {
    if (!chunks) return;
    this.addChunkedInstancesByKey(chunks, geometry, material, castShadow, receiveShadow);
  }

  private addChunkedInstancesByKey(
    chunks: Map<string, InstanceSpec[]>,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    castShadow: boolean,
    receiveShadow: boolean,
  ): void {
    for (const instances of chunks.values()) {
      const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
      const matrix = new THREE.Matrix4();
      const rotation = new THREE.Quaternion();
      instances.forEach((instance, index) => {
        rotation.setFromEuler(instance.rotation);
        matrix.compose(instance.position, rotation, instance.scale);
        mesh.setMatrixAt(index, matrix);
        if (instance.color) mesh.setColorAt(index, instance.color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      this.scene.add(mesh);
    }
  }

  private buildRuin(): void {
    const center = new THREE.Vector3(-15, this.getSurfaceHeight(-15, -13), -13);
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.38, 8),
      this.assets.materials.ruin,
    );
    platform.position.set(center.x, center.y + 0.16, center.z);
    platform.receiveShadow = true;
    this.trackObject(platform);
    this.scene.add(platform);
    this.addCollider(center.x, center.y + 0.16, center.z, 10, 0.38, 8);

    const pillars = [
      [-4, -2.7, 3.3], [4, -2.7, 3.3], [-4, 2.7, 3.3], [4, 2.7, 1.7],
    ];
    for (const [dx, dz, height] of pillars) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.58, height, 8, 2),
        this.assets.materials.ruin,
      );
      pillar.position.set(center.x + dx, center.y + 0.36 + height / 2, center.z + dz);
      pillar.rotation.z = dx === 4 && dz === 2.7 ? 0.08 : 0;
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.trackObject(pillar);
      this.scene.add(pillar);
      this.addCollider(pillar.position.x, pillar.position.y, pillar.position.z, 1, height, 1);
    }

    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.65, 0.85),
      this.assets.materials.ruin,
    );
    lintel.position.set(center.x, center.y + 3.72, center.z - 2.7);
    lintel.rotation.z = -0.035;
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    this.trackObject(lintel);
    this.scene.add(lintel);

    const brokenArch = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.2, 7, 12, Math.PI * 0.85),
      this.assets.materials.ruin,
    );
    brokenArch.position.set(center.x, center.y + 1.15, center.z - 0.7);
    brokenArch.rotation.z = Math.PI;
    brokenArch.castShadow = true;
    this.trackObject(brokenArch);
    this.scene.add(brokenArch);

    const rune = new THREE.PointLight(0x81b6a2, 2.2, 7);
    rune.position.set(center.x, center.y + 1.7, center.z);
    this.scene.add(rune);

    const rubbleGeometry = new THREE.DodecahedronGeometry(1, 0);
    this.geometries.add(rubbleGeometry);
    for (let i = 0; i < 17; i++) {
      const angle = (i / 17) * Math.PI * 2;
      const radius = 5.3 + (i % 3) * 0.45;
      const rubble = new THREE.Mesh(rubbleGeometry, this.assets.materials.ruin);
      rubble.position.set(
        center.x + Math.cos(angle) * radius,
        center.y + 0.25,
        center.z + Math.sin(angle) * radius,
      );
      rubble.rotation.set(angle * 0.4, angle, angle * 0.2);
      rubble.scale.set(0.45 + (i % 4) * 0.12, 0.25 + (i % 3) * 0.09, 0.5 + (i % 5) * 0.1);
      rubble.castShadow = true;
      rubble.receiveShadow = true;
      this.scene.add(rubble);
    }
  }

  private buildCave(): void {
    const x = 19;
    const z = -4;
    const ground = this.getSurfaceHeight(x, z);
    const entrance = new THREE.Group();
    entrance.position.set(x, ground, z);

    const boulderGeometry = new THREE.DodecahedronGeometry(1.8, 1);
    this.geometries.add(boulderGeometry);
    for (const [dx, dy, dz, sx, sy, sz] of [
      [-3.6, 1.5, 0, 1.9, 1.5, 1.4],
      [3.8, 1.8, -0.15, 2.1, 1.8, 1.6],
      [-2.2, 3.25, 0, 2.2, 1.3, 1.45],
      [2, 3.55, -0.1, 2.4, 1.55, 1.6],
    ]) {
      const rock = new THREE.Mesh(boulderGeometry, this.assets.materials.stone);
      rock.position.set(dx, dy, dz);
      rock.scale.set(sx, sy, sz);
      rock.rotation.y = dx * 0.22;
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.trackObject(rock);
      entrance.add(rock);
    }
    const mouth = new THREE.Mesh(
      new THREE.CircleGeometry(2.05, 24),
      new THREE.MeshBasicMaterial({ color: 0x111714, side: THREE.DoubleSide }),
    );
    mouth.position.set(0, 1.38, 1.55);
    entrance.add(mouth);
    const glow = new THREE.PointLight(0x78a994, 0.75, 6);
    glow.position.set(0, 1, 1.1);
    entrance.add(glow);

    const roots = new THREE.Mesh(
      new THREE.TorusGeometry(2.05, 0.11, 5, 18, Math.PI * 1.2),
      this.assets.materials.bark,
    );
    roots.position.set(0, 1.35, 1.62);
    roots.rotation.z = Math.PI * 0.84;
    roots.castShadow = true;
    entrance.add(roots);
    this.trackObject(entrance);
    this.scene.add(entrance);
  }

  private buildAbandonedCamp(): void {
    const x = -29;
    const z = 17;
    const ground = this.getSurfaceHeight(x, z);
    const camp = new THREE.Group();
    camp.position.set(x, ground, z);

    const canvas = new THREE.MeshStandardMaterial({
      color: 0x817250,
      roughness: 1,
      side: THREE.DoubleSide,
    });
    this.materials.add(canvas);
    const tornTent = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.8, 4, 1, true), canvas);
    tornTent.position.set(-1.5, 0.88, 0.1);
    tornTent.rotation.y = Math.PI * 0.25;
    tornTent.scale.set(1, 1, 0.85);
    tornTent.castShadow = true;
    camp.add(tornTent);

    const wood = this.assets.materials.bark;
    const poleGeometry = new THREE.CylinderGeometry(0.045, 0.07, 2.15, 6);
    this.geometries.add(poleGeometry);
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(poleGeometry, wood);
      pole.position.set(-1.5 + side * 1.2, 0.72, 0.1);
      pole.rotation.z = side * 0.58;
      pole.castShadow = true;
      camp.add(pole);
    }

    const bedroll = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.18, 0.8),
      this.assets.materials.cloth,
    );
    bedroll.position.set(-1.25, 0.15, 1.4);
    bedroll.rotation.y = -0.18;
    camp.add(bedroll);

    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.65, 0.82),
      this.assets.materials.bark,
    );
    crate.position.set(1.65, 0.34, -0.8);
    crate.rotation.y = 0.24;
    crate.castShadow = true;
    crate.receiveShadow = true;
    camp.add(crate);
    const crateLid = new THREE.Mesh(
      new THREE.BoxGeometry(0.94, 0.12, 0.86),
      this.assets.materials.bark,
    );
    crateLid.position.set(1.65, 0.7, -0.8);
    crateLid.rotation.z = 0.16;
    camp.add(crateLid);

    const firepit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1, 0.12, 12),
      this.assets.materials.stone,
    );
    firepit.position.set(1, 0.06, 1.55);
    firepit.castShadow = true;
    camp.add(firepit);
    const ashes = new THREE.Mesh(
      new THREE.CircleGeometry(0.58, 12),
      new THREE.MeshStandardMaterial({ color: 0x272723, roughness: 1 }),
    );
    ashes.rotation.x = -Math.PI / 2;
    ashes.position.set(1, 0.13, 1.55);
    camp.add(ashes);

    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.075, 6, 12),
      wood,
    );
    wheel.position.set(2.65, 0.68, 0.5);
    wheel.rotation.y = 0.78;
    wheel.rotation.x = 0.18;
    camp.add(wheel);
    for (let spoke = 0; spoke < 6; spoke++) {
      const angle = (spoke / 6) * Math.PI * 2;
      const spokeMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.04, 1.16, 5),
        wood,
      );
      spokeMesh.position.set(
        2.65 + Math.sin(angle) * 0.08,
        0.68 + Math.sin(angle) * 0.48,
        0.5 + Math.cos(angle) * 0.48,
      );
      spokeMesh.rotation.z = Math.PI / 2 - angle;
      camp.add(spokeMesh);
    }

    const scatteredWood = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 1.45, 7),
      wood,
    );
    scatteredWood.position.set(0.35, 0.12, -1.75);
    scatteredWood.rotation.set(1.48, -0.35, 0.25);
    scatteredWood.castShadow = true;
    camp.add(scatteredWood);
    this.trackObject(camp);
    this.scene.add(camp);
  }

  private buildLighting(): void {
    this.hemisphere = new THREE.HemisphereLight(
      0xc8dcf5,
      0x493a36,
      this.graphics.hemisphereLightIntensity,
    );
    this.scene.add(this.hemisphere);
    this.sun = new THREE.DirectionalLight(0xffd5a1, this.graphics.directionalLightIntensity);
    this.sun.position.set(-28, 52, 25);
    this.sun.castShadow = this.graphics.shadows;
    this.sun.shadow.mapSize.set(this.graphics.shadowMapSize, this.graphics.shadowMapSize);
    this.sun.shadow.camera.left = -43;
    this.sun.shadow.camera.right = 43;
    this.sun.shadow.camera.top = 43;
    this.sun.shadow.camera.bottom = -43;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 125;
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  private buildParticles(): void {
    const random = randomGenerator(27183);
    const positions = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 5 + random() * 45;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = this.getSurfaceHeight(positions[i * 3], Math.sin(angle) * radius) + 0.4 + random() * 6;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometries.add(geometry);
    const material = new THREE.PointsMaterial({
      color: 0xe7dcb8,
      size: 0.09,
      transparent: true,
      opacity: 0.32,
      sizeAttenuation: true,
      depthWrite: false,
    });
    this.materials.add(material);
    this.particles = new THREE.Points(geometry, material);
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
  }

  private addCollider(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
  ): void {
    const body = this.physics.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z),
    );
    this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2),
      body,
    );
    this.colliders.push(body);
  }

  private addTrunkCollider(x: number, ground: number, z: number, scale: number): void {
    const body = this.physics.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(x, ground + 1.45 * scale, z),
    );
    this.physics.createCollider(
      RAPIER.ColliderDesc.cylinder(1.45 * scale, 0.24 * scale),
      body,
    );
    this.colliders.push(body);
  }

  private distanceToCurve(
    x: number,
    z: number,
    curve: THREE.CatmullRomCurve3,
    samples: number,
  ): number {
    let nearestSquared = Number.POSITIVE_INFINITY;
    let points = this.curvePoints.get(curve);
    if (!points) {
      points = curve.getPoints(samples);
      this.curvePoints.set(curve, points);
    }
    for (const point of points) {
      const dx = x - point.x;
      const dz = z - point.z;
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared < nearestSquared) nearestSquared = distanceSquared;
    }
    return Math.sqrt(nearestSquared);
  }

  private trackObject<T extends THREE.Object3D>(object: T): T {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        this.geometries.add(child.geometry);
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (!Object.values(this.assets.materials).includes(material)) this.materials.add(material);
        });
      }
    });
    return object;
  }

  dispose(): void {
    this.disposed = true;
    this.audio.dispose();
    for (const body of this.colliders) this.physics.removeRigidBody(body);
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.scene.clear();
    this.scene.background = null;
    this.scene.fog = null;
    this.colliders.length = 0;
    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
    this.curvePoints.clear();
    this.windUniforms.length = 0;
  }
}
