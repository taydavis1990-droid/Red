import * as THREE from 'three';

const toonGradient = new THREE.DataTexture(
  new Uint8Array([
    70, 70, 70, 255,
    115, 115, 115, 255,
    175, 175, 175, 255,
    235, 235, 235, 255,
  ]),
  4,
  1,
  THREE.RGBAFormat,
);
toonGradient.magFilter = THREE.NearestFilter;
toonGradient.minFilter = THREE.NearestFilter;
toonGradient.generateMipmaps = false;
toonGradient.needsUpdate = true;

export function actorToonMaterial(color: THREE.ColorRepresentation): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient });
}

export function organicForm(height: number, width: number, depth: number, profile: readonly number[]): THREE.BufferGeometry {
  const rows = 16;
  const columns = 24;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const profileIndex = t * (profile.length - 1);
    const low = Math.floor(profileIndex);
    const blend = profileIndex - low;
    const radius = THREE.MathUtils.lerp(profile[low], profile[Math.min(low + 1, profile.length - 1)], blend);
    for (let column = 0; column <= columns; column++) {
      const angle = (column / columns) * Math.PI * 2;
      const shaping = 1 + 0.035 * Math.cos(angle * 2) * Math.sin(t * Math.PI);
      positions.push(
        Math.cos(angle) * width * radius * shaping,
        (t - 0.5) * height,
        Math.sin(angle) * depth * radius * shaping,
      );
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column;
        const b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
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
