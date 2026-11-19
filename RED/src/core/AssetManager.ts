import * as THREE from 'three';

export interface LoadedModel {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

export interface PBRMaterialOptions extends Omit<
  THREE.MeshStandardMaterialParameters,
  'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'aoMap'
> {
  baseColorMap?: string;
  normalMap?: string;
  roughnessMap?: string;
  metallicMap?: string;
  ambientOcclusionMap?: string;
}

type PBRMapName = 'baseColorMap' | 'normalMap' | 'roughnessMap' | 'metallicMap' | 'ambientOcclusionMap';

interface CachedModel {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  resources: ModelResources;
}

interface ModelResources {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
  textures: Set<THREE.Texture>;
}

export class AssetManager {
  readonly materials = {
    ground: new THREE.MeshStandardMaterial({ color: 0x526348, roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x72804e, roughness: 1 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x493a2d, roughness: 1 }),
    leaves: new THREE.MeshStandardMaterial({ color: 0x294a36, roughness: 0.95 }),
    leavesLight: new THREE.MeshStandardMaterial({ color: 0x496b43, roughness: 0.95 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x77796f, roughness: 1 }),
    ruin: new THREE.MeshStandardMaterial({ color: 0x948b70, roughness: 0.92 }),
    water: new THREE.MeshStandardMaterial({ color: 0x4f9d9b, roughness: 0.25, metalness: 0.12, transparent: true, opacity: 0.84 }),
    player: new THREE.MeshStandardMaterial({ color: 0x9b6240, roughness: 0.82 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x3e5543, roughness: 0.9 }),
    wolf: new THREE.MeshStandardMaterial({ color: 0x77776b, roughness: 0.9 }),
    deer: new THREE.MeshStandardMaterial({ color: 0x98734e, roughness: 0.9 }),
    bear: new THREE.MeshStandardMaterial({ color: 0x49352c, roughness: 0.95 }),
    spirit: new THREE.MeshStandardMaterial({ color: 0x87d9d4, emissive: 0x278c93, emissiveIntensity: 1.8, transparent: true, opacity: 0.72 }),
  };

  private readonly textureLoader = new THREE.TextureLoader();
  private readonly modelCache = new Map<string, Promise<CachedModel>>();
  private readonly textureCache = new Map<string, Promise<THREE.Texture>>();
  private readonly loadedMaterials = new Set<THREE.Material>();
  private readonly modelInstances = new Map<THREE.Object3D, ModelResources>();
  private readonly modelResourceReferences = new Map<THREE.BufferGeometry | THREE.Material | THREE.Texture, number>();
  private disposed = false;
  private maxAnisotropy: number;

  constructor(
    maxAnisotropy = 1,
    private readonly reportError: (message: string, error: unknown) => void = (message, error) => {
      console.error(message, error);
    },
  ) {
    this.maxAnisotropy = maxAnisotropy;
  }

  setTextureAnisotropy(value: number): void {
    if (this.disposed) return;
    this.maxAnisotropy = Math.max(1, value);
    for (const request of this.textureCache.values()) {
      void request.then((texture) => {
        texture.anisotropy = this.maxAnisotropy;
      }, () => undefined);
    }
  }

  async loadModel(
    assetPath: string,
    fallback: () => THREE.Group,
  ): Promise<LoadedModel> {
    try {
      const url = this.resolveAssetUrl(assetPath);
      let request = this.modelCache.get(url);
      if (!request) {
        request = import('three/addons/loaders/GLTFLoader.js')
          .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(url))
          .then((gltf) => {
            const resources = this.collectModelResources(gltf.scene);
            this.retainModelResources(resources);
            return { scene: gltf.scene, animations: gltf.animations, resources };
          })
          .catch((error: unknown) => {
            this.modelCache.delete(url);
            throw error;
          });
        this.modelCache.set(url, request);
      }

      const [cached, skeletonUtils] = await Promise.all([
        request,
        import('three/addons/utils/SkeletonUtils.js'),
      ]);
      if (this.disposed) return { scene: fallback(), animations: [] };
      const scene = skeletonUtils.clone(cached.scene);
      const resources = this.collectModelResources(scene);
      this.retainModelResources(resources);
      this.modelInstances.set(scene, resources);
      return { scene, animations: cached.animations };
    } catch (error) {
      this.reportError(`Could not load 3D asset "${assetPath}".`, error);
      return { scene: fallback(), animations: [] };
    }
  }

  releaseModel(scene: THREE.Object3D): void {
    const resources = this.modelInstances.get(scene);
    if (!resources) return;
    this.modelInstances.delete(scene);
    this.releaseModelResources(resources);
  }

  async loadTexture(
    assetPath: string,
    colorTexture = false,
  ): Promise<THREE.Texture> {
    let url: string;
    try {
      url = this.resolveAssetUrl(assetPath);
    } catch (error) {
      this.reportError(`Could not resolve texture "${assetPath}".`, error);
      throw error;
    }
    const cacheKey = `${url}|${colorTexture ? 'srgb' : 'linear'}`;
    let request = this.textureCache.get(cacheKey);
    if (!request) {
      request = this.textureLoader.loadAsync(url).then((texture) => {
        texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.anisotropy = this.maxAnisotropy;
        return texture;
      }).catch((error: unknown) => {
        this.textureCache.delete(cacheKey);
        this.reportError(`Could not load texture "${assetPath}".`, error);
        throw error;
      });
      this.textureCache.set(cacheKey, request);
    }
    return request;
  }

  async createPBRMaterial(options: PBRMaterialOptions): Promise<THREE.MeshStandardMaterial> {
    const configuredMaps: Array<[PBRMapName, string, boolean]> = [
      ['baseColorMap', options.baseColorMap ?? '', true],
      ['normalMap', options.normalMap ?? '', false],
      ['roughnessMap', options.roughnessMap ?? '', false],
      ['metallicMap', options.metallicMap ?? '', false],
      ['ambientOcclusionMap', options.ambientOcclusionMap ?? '', false],
    ];
    const mapUrls = configuredMaps.filter(([, url]) => url.length > 0);
    const results = await Promise.allSettled(
      mapUrls.map(([, url, colorTexture]) => this.loadTexture(url, colorTexture)),
    );
    const maps: Partial<Record<PBRMapName, THREE.Texture>> = {};
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') maps[mapUrls[index][0]] = result.value;
    });

    const {
      baseColorMap: _baseColorMap,
      normalMap: _normalMap,
      roughnessMap: _roughnessMap,
      metallicMap: _metallicMap,
      ambientOcclusionMap: _ambientOcclusionMap,
      ...materialOptions
    } = options;
    const material = new THREE.MeshStandardMaterial({
      ...materialOptions,
      map: maps.baseColorMap,
      normalMap: maps.normalMap,
      roughnessMap: maps.roughnessMap,
      metalnessMap: maps.metallicMap,
      aoMap: maps.ambientOcclusionMap,
    });
    this.loadedMaterials.add(material);
    return material;
  }

  resolveAssetUrl(assetPath: string): string {
    const projectRelativePath = assetPath.startsWith('/') && !assetPath.startsWith('//')
      ? assetPath.slice(1)
      : assetPath;
    return new URL(projectRelativePath, document.baseURI).href;
  }

  createTree(scale = 1): THREE.Group {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 2.3, 5), this.materials.bark);
    trunk.position.y = 1.15;
    trunk.castShadow = true;
    tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.8, 6), this.materials.leaves);
    crown.position.y = 3.1;
    crown.castShadow = true;
    tree.add(crown);
    const crown2 = new THREE.Mesh(new THREE.ConeGeometry(0.76, 2.1, 6), this.materials.leavesLight);
    crown2.position.set(0.12, 4.0, 0.05);
    crown2.castShadow = true;
    tree.add(crown2);
    tree.scale.setScalar(scale);
    return tree;
  }

  createRock(scale: number): THREE.Mesh {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), this.materials.stone);
    rock.scale.set(scale * 1.1, scale * 0.7, scale);
    rock.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.3);
    rock.castShadow = true;
    rock.receiveShadow = true;
    return rock;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const scene of [...this.modelInstances.keys()]) this.releaseModel(scene);

    const materials = new Set<THREE.Material>([
      ...Object.values(this.materials),
      ...this.loadedMaterials,
    ]);
    for (const request of this.modelCache.values()) {
      void request.then(({ resources }) => this.releaseModelResources(resources), () => undefined);
    }
    for (const request of this.textureCache.values()) {
      void request.then((texture) => {
        texture.dispose();
      }, () => undefined);
    }
    this.disposeResources(new Set(), materials, new Set());
    this.modelCache.clear();
    this.textureCache.clear();
    this.loadedMaterials.clear();
    this.modelInstances.clear();
  }

  private collectModelResources(scene: THREE.Object3D): ModelResources {
    const resources: ModelResources = {
      geometries: new Set(),
      materials: new Set(),
      textures: new Set(),
    };
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      resources.geometries.add(object.geometry);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        resources.materials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) resources.textures.add(value);
        }
      }
    });
    return resources;
  }

  private retainModelResources(resources: ModelResources): void {
    for (const resource of [...resources.geometries, ...resources.materials, ...resources.textures]) {
      this.modelResourceReferences.set(resource, (this.modelResourceReferences.get(resource) ?? 0) + 1);
    }
  }

  private releaseModelResources(resources: ModelResources): void {
    const disposeWhenUnused = (resource: THREE.BufferGeometry | THREE.Material | THREE.Texture): void => {
      const references = (this.modelResourceReferences.get(resource) ?? 1) - 1;
      if (references > 0) {
        this.modelResourceReferences.set(resource, references);
        return;
      }
      this.modelResourceReferences.delete(resource);
      resource.dispose();
    };
    for (const geometry of resources.geometries) disposeWhenUnused(geometry);
    for (const material of resources.materials) disposeWhenUnused(material);
    for (const texture of resources.textures) disposeWhenUnused(texture);
  }

  private disposeResources(
    geometries: Set<THREE.BufferGeometry>,
    materials: Set<THREE.Material>,
    textures: Set<THREE.Texture>,
  ): void {
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
      material.dispose();
    }
    for (const texture of textures) texture.dispose();
  }
}
