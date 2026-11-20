import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type ActorSurface = 'skin' | 'cloth' | 'leather' | 'fur' | 'hair' | 'iron' | 'steel' | 'bronze' | 'bone';

interface SurfaceProfile {
  roughness: number;
  metalness: number;
  normalStrength: number;
  repeat: number;
}

interface SurfaceMaps {
  color: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
}

export interface FormSection {
  position: number;
  width: number;
  depth: number;
  offset?: number;
}

const SURFACE_PROFILES: Record<ActorSurface, SurfaceProfile> = {
  skin: { roughness: 0.76, metalness: 0, normalStrength: 0.22, repeat: 2 },
  cloth: { roughness: 0.94, metalness: 0, normalStrength: 0.3, repeat: 3 },
  leather: { roughness: 0.83, metalness: 0.02, normalStrength: 0.38, repeat: 2 },
  fur: { roughness: 0.98, metalness: 0, normalStrength: 0.5, repeat: 3 },
  hair: { roughness: 0.78, metalness: 0, normalStrength: 0.3, repeat: 2 },
  iron: { roughness: 0.54, metalness: 0.78, normalStrength: 0.24, repeat: 2 },
  steel: { roughness: 0.34, metalness: 0.9, normalStrength: 0.16, repeat: 2 },
  bronze: { roughness: 0.4, metalness: 0.82, normalStrength: 0.22, repeat: 2 },
  bone: { roughness: 0.68, metalness: 0, normalStrength: 0.18, repeat: 2 },
};

const surfaceMapCache = new Map<ActorSurface, SurfaceMaps>();

function noise(x: number, y: number, seed: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

function surfaceHeight(x: number, y: number, surface: ActorSurface): number {
  const grain = noise(x, y, surface.length) - 0.5;
  const broad = noise(Math.floor(x / 4), Math.floor(y / 4), surface.length + 2) - 0.5;
  if (surface === 'cloth') {
    const weave = Math.sin(x * Math.PI * 0.5) * Math.sin(y * Math.PI * 0.5);
    return 0.5 + grain * 0.14 + broad * 0.08 + weave * 0.18;
  }
  if (surface === 'fur' || surface === 'hair') {
    const strands = Math.sin(x * Math.PI * 0.6 + Math.sin(y * 0.08) * 0.7);
    return 0.5 + grain * 0.22 + broad * 0.1 + strands * (surface === 'fur' ? 0.18 : 0.13);
  }
  if (surface === 'leather') {
    const crease = Math.sin(x * 0.16 + Math.sin(y * 0.045) * 1.4);
    return 0.5 + grain * 0.28 + broad * 0.12 + crease * 0.08;
  }
  if (surface === 'iron' || surface === 'steel' || surface === 'bronze') {
    const brush = Math.sin(y * 0.38 + Math.sin(x * 0.025));
    const scratch = Math.sin(x * 0.19 + y * 0.025) > 0.992 ? 0.24 : 0;
    return 0.5 + grain * 0.12 + broad * 0.08 + brush * 0.09 + scratch;
  }
  if (surface === 'skin') {
    const pores = noise(x * 3, y * 3, 19) > 0.955 ? -0.22 : 0;
    return 0.5 + grain * 0.12 + broad * 0.1 + pores;
  }
  return 0.5 + grain * 0.1 + broad * 0.08;
}

function makeDataTexture(data: Uint8Array<ArrayBuffer>, colorSpace: THREE.ColorSpace): THREE.DataTexture {
  const size = 128;
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function getSurfaceMaps(surface: ActorSurface): SurfaceMaps {
  const cached = surfaceMapCache.get(surface);
  if (cached) return cached;

  const size = 128;
  const heights = new Float32Array(size * size);
  const colorData = new Uint8Array(new ArrayBuffer(size * size * 4));
  const roughnessData = new Uint8Array(new ArrayBuffer(size * size * 4));
  const normalData = new Uint8Array(new ArrayBuffer(size * size * 4));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      const detail = surfaceHeight(x, y, surface);
      heights[index] = detail;
      const variation = noise(x, y, surface.length + 8) * 26 - 13;
      const albedo = THREE.MathUtils.clamp(210 + (detail - 0.5) * 58 + variation, 128, 250);
      const roughness = THREE.MathUtils.clamp(
        (SURFACE_PROFILES[surface].roughness + (detail - 0.5) * 0.28) * 255,
        0,
        255,
      );
      const offset = index * 4;
      colorData[offset] = albedo;
      colorData[offset + 1] = albedo;
      colorData[offset + 2] = albedo;
      colorData[offset + 3] = 255;
      roughnessData[offset] = roughness;
      roughnessData[offset + 1] = roughness;
      roughnessData[offset + 2] = roughness;
      roughnessData[offset + 3] = 255;
    }
  }

  const strength = SURFACE_PROFILES[surface].normalStrength * 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const left = heights[y * size + ((x + size - 1) % size)];
      const right = heights[y * size + ((x + 1) % size)];
      const up = heights[((y + size - 1) % size) * size + x];
      const down = heights[((y + 1) % size) * size + x];
      const nx = -(right - left) * strength;
      const ny = -(down - up) * strength;
      const length = Math.sqrt(nx * nx + ny * ny + 1);
      const offset = (y * size + x) * 4;
      normalData[offset] = (nx / length * 0.5 + 0.5) * 255;
      normalData[offset + 1] = (ny / length * 0.5 + 0.5) * 255;
      normalData[offset + 2] = (1 / length * 0.5 + 0.5) * 255;
      normalData[offset + 3] = 255;
    }
  }

  const profile = SURFACE_PROFILES[surface];
  const maps = {
    color: makeDataTexture(colorData, THREE.SRGBColorSpace),
    normal: makeDataTexture(normalData, THREE.NoColorSpace),
    roughness: makeDataTexture(roughnessData, THREE.NoColorSpace),
  };
  for (const texture of Object.values(maps)) texture.repeat.set(profile.repeat, profile.repeat);
  surfaceMapCache.set(surface, maps);
  return maps;
}

export function actorMaterial(color: THREE.ColorRepresentation, surface: ActorSurface): THREE.MeshStandardMaterial {
  const profile = SURFACE_PROFILES[surface];
  const maps = getSurfaceMaps(surface);
  const material = new THREE.MeshStandardMaterial({
    color,
    map: maps.color,
    normalMap: maps.normal,
    roughnessMap: maps.roughness,
    roughness: profile.roughness,
    metalness: profile.metalness,
  });
  material.normalScale.setScalar(profile.normalStrength);
  return material;
}

export function organicForm(height: number, width: number, depth: number, profile: readonly number[]): THREE.BufferGeometry {
  const rows = 24;
  const columns = 32;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const profileIndex = t * (profile.length - 1);
    const low = Math.floor(profileIndex);
    const blend = profileIndex - low;
    const radius = THREE.MathUtils.lerp(profile[low], profile[Math.min(low + 1, profile.length - 1)], blend);
    for (let column = 0; column <= columns; column++) {
      const u = column / columns;
      const angle = u * Math.PI * 2;
      const shaping = 1 + 0.025 * Math.cos(angle * 2) * Math.sin(t * Math.PI);
      positions.push(
        Math.cos(angle) * width * radius * shaping,
        (t - 0.5) * height,
        Math.sin(angle) * depth * radius * shaping,
      );
      uvs.push(u, t);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column;
        const b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function interpolateSection(
  sections: readonly FormSection[],
  t: number,
  field: keyof FormSection,
): number {
  const position = THREE.MathUtils.lerp(sections[0].position, sections[sections.length - 1].position, t);
  let index = 0;
  while (index < sections.length - 2 && sections[index + 1].position < position) index++;
  const span = sections[index + 1].position - sections[index].position;
  const local = span > 0 ? (position - sections[index].position) / span : 0;
  const before = sections[Math.max(0, index - 1)][field] ?? 0;
  const start = sections[index][field] ?? 0;
  const end = sections[index + 1][field] ?? 0;
  const after = sections[Math.min(sections.length - 1, index + 2)][field] ?? 0;
  const local2 = local * local;
  const local3 = local2 * local;
  return 0.5 * (
    2 * start
    + (-before + end) * local
    + (2 * before - 5 * start + 4 * end - after) * local2
    + (-before + 3 * start - 3 * end + after) * local3
  );
}

function loftedForm(
  sections: readonly FormSection[],
  axis: 'y' | 'z',
  longitudinalSegments = 32,
  radialSegments = 24,
): THREE.BufferGeometry {
  if (sections.length < 2) throw new Error('A loft needs at least two profile sections.');
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const firstPosition = sections[0].position;
  const lastPosition = sections[sections.length - 1].position;

  for (let row = 0; row <= longitudinalSegments; row++) {
    const t = row / longitudinalSegments;
    const section: FormSection = {
      position: THREE.MathUtils.lerp(firstPosition, lastPosition, t),
      width: Math.max(0.001, interpolateSection(sections, t, 'width')),
      depth: Math.max(0.001, interpolateSection(sections, t, 'depth')),
      offset: interpolateSection(sections, t, 'offset'),
    };
    for (let column = 0; column <= radialSegments; column++) {
      const u = column / radialSegments;
      const angle = u * Math.PI * 2;
      const across = Math.cos(angle);
      const height = Math.sin(angle);
      positions.push(
        across * section.width,
        axis === 'y' ? section.position : section.offset! + height * section.depth,
        axis === 'y' ? section.offset! + height * section.depth : section.position,
      );
      uvs.push(u, t);
      if (row < longitudinalSegments && column < radialSegments) {
        const a = row * (radialSegments + 1) + column;
        const b = a + radialSegments + 1;
        if (axis === 'y') indices.push(a, b, a + 1, b, b + 1, a + 1);
        else indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function verticalLoft(sections: readonly FormSection[]): THREE.BufferGeometry {
  return loftedForm(sections, 'y');
}

export function longitudinalLoft(sections: readonly FormSection[]): THREE.BufferGeometry {
  return loftedForm(sections, 'z');
}

export function sweptTube(
  points: readonly THREE.Vector3[],
  radius: number,
  tubularSegments = 24,
  radialSegments = 8,
): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3([...points]);
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
}

export function consolidateActorMeshes(root: THREE.Object3D): void {
  const parents = new Set<THREE.Object3D>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.parent) parents.add(object.parent);
  });

  for (const parent of parents) {
    const groups = new Map<string, { material: THREE.Material; meshes: THREE.Mesh[] }>();
    for (const child of [...parent.children]) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
      const attributes = Object.keys(child.geometry.attributes)
        .map((name) => {
          const attribute = child.geometry.getAttribute(name);
          return `${name}:${attribute.itemSize}:${attribute.normalized}`;
        })
        .sort()
        .join(',');
      const key = `${child.material.id}|${Boolean(child.geometry.index)}|${attributes}`;
      const group = groups.get(key);
      if (group) group.meshes.push(child);
      else groups.set(key, { material: child.material, meshes: [child] });
    }

    for (const { material, meshes } of groups.values()) {
      if (meshes.length < 2) continue;
      const transformed = meshes.map((child) => {
        child.updateMatrix();
        return child.geometry.clone().applyMatrix4(child.matrix);
      });
      const geometry = mergeGeometries(transformed, false);
      transformed.forEach((source) => source.dispose());
      if (!geometry) continue;

      const combined = new THREE.Mesh(geometry, material);
      combined.castShadow = true;
      combined.receiveShadow = true;
      parent.add(combined);
      for (const child of meshes) {
        parent.remove(child);
        child.geometry.dispose();
      }
    }
  }
}

export function disposeActorModel(model: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const surface of meshMaterials) materials.add(surface);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const surface of materials) surface.dispose();
}
