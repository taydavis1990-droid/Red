import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AssetManager } from './core/AssetManager';
import { CreatureAssetLoader, type GLTFCreatureRig } from './creatures/CreatureAssetLoader';
import { MONSTER_PREVIEW_ASSETS } from './creatures/CreatureAssetConfig';
import './monster-preview.css';

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Monster preview element "${selector}" is missing.`);
  return element;
}

const canvas = requireElement<HTMLCanvasElement>('#monster-canvas');
const modelSelect = requireElement<HTMLSelectElement>('#model-select');
const clipSelect = requireElement<HTMLSelectElement>('#clip-select');
const status = requireElement<HTMLParagraphElement>('#load-status');
const report = requireElement<HTMLElement>('#model-report');
const details = requireElement<HTMLPreElement>('#model-details');
const heightControl = requireElement<HTMLInputElement>('#height-control');
const heightValue = requireElement<HTMLOutputElement>('#height-value');
const yawControl = requireElement<HTMLInputElement>('#yaw-control');
const yawValue = requireElement<HTMLOutputElement>('#yaw-value');
const skeletonControl = requireElement<HTMLInputElement>('#skeleton-control');
const resetButton = requireElement<HTMLButtonElement>('#reset-view');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x151b1a);
scene.fog = new THREE.Fog(0x151b1a, 18, 38);

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
camera.position.set(5, 3.2, 7);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1;
controls.maxDistance = 18;
controls.target.set(0, 0.9, 0);

scene.add(new THREE.HemisphereLight(0xc4d1dc, 0x332d25, 2.4));
const keyLight = new THREE.DirectionalLight(0xffe6c2, 3.1);
keyLight.position.set(-4, 8, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -8;
keyLight.shadow.camera.right = 8;
keyLight.shadow.camera.top = 8;
keyLight.shadow.camera.bottom = -8;
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xdce9f5, 3.5);
fillLight.position.set(5, 5, 7);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0x9bb7ca, 2.8);
rimLight.position.set(4, 4, -5);
scene.add(rimLight);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(12, 72),
  new THREE.MeshStandardMaterial({ color: 0x30332e, roughness: 0.94, metalness: 0.02 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(18, 36, 0x706447, 0x343a35);
grid.position.y = 0.003;
scene.add(grid);

const assets = new AssetManager(
  Math.min(8, renderer.capabilities.getMaxAnisotropy()),
  (message, error) => {
    console.error(message, error);
    setStatus(`${message} ${String(error)}`, 'error');
  },
);
const creatureLoader = new CreatureAssetLoader(assets);
let currentRig: GLTFCreatureRig | null = null;
let skeletonHelper: THREE.SkeletonHelper | null = null;
let loadSequence = 0;
let selectedConfig = MONSTER_PREVIEW_ASSETS[0];
let targetHeight = selectedConfig.targetHeight;

for (const config of MONSTER_PREVIEW_ASSETS) {
  const option = document.createElement('option');
  option.value = config.id;
  option.textContent = config.label;
  modelSelect.append(option);
}
const previewQuery = new URLSearchParams(window.location.search);
const requestedModel = previewQuery.get('asset');
if (requestedModel && MONSTER_PREVIEW_ASSETS.some((asset) => asset.id === requestedModel)) {
  modelSelect.value = requestedModel;
}

function setStatus(message: string, state: 'loading' | 'success' | 'error'): void {
  status.textContent = message;
  status.dataset.state = state;
}

function addReportRow(label: string, value: string, className = ''): void {
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  description.textContent = value;
  if (className) description.className = className;
  report.append(term, description);
}

async function loadSelectedModel(): Promise<void> {
  const config = MONSTER_PREVIEW_ASSETS.find((item) => item.id === modelSelect.value);
  if (!config) {
    setStatus(`Unknown monster selection: ${modelSelect.value}`, 'error');
    return;
  }

  const sequence = ++loadSequence;
  currentRig?.dispose();
  currentRig = null;
  if (skeletonHelper) scene.remove(skeletonHelper);
  skeletonHelper = null;
  report.replaceChildren();
  details.textContent = 'Loading model metadata...';
  clipSelect.replaceChildren();
  clipSelect.disabled = true;
  skeletonControl.checked = false;
  skeletonControl.disabled = true;
  selectedConfig = config;
  targetHeight = config.targetHeight;
  heightControl.value = String(targetHeight);
  yawControl.value = String(THREE.MathUtils.radToDeg(config.rotationY ?? 0));
  heightValue.value = `${targetHeight.toFixed(2)} m`;
  yawValue.value = `${yawControl.value} deg`;
  setStatus(`Loading ${config.path}...`, 'loading');

  try {
    const rig = await creatureLoader.load(config);
    if (sequence !== loadSequence) {
      rig.dispose();
      return;
    }

    currentRig = rig;
    scene.add(rig.model);
    controls.target.set(0, targetHeight * 0.48, 0);
    camera.position.set(targetHeight * 1.65, targetHeight * 1.1, targetHeight * 2.3);
    controls.update();

    const modelReport = rig.report;
    const statusClass = modelReport.status === 'Static'
      ? 'status-static'
      : modelReport.clips.length
        ? 'status-animated'
        : 'status-rigged';
    addReportRow('Animation state', modelReport.status, statusClass);
    addReportRow('File size', `${(modelReport.fileSizeBytes / 1024 / 1024).toFixed(2)} MiB`);
    addReportRow('Triangles', modelReport.triangleCount.toLocaleString());
    addReportRow('Meshes / skinned', `${modelReport.meshCount} / ${modelReport.skinnedMeshCount}`);
    addReportRow('Skeleton bones', String(modelReport.bones.length));
    addReportRow(
      'Source bounds (W x H x D)',
      `${modelReport.sourceBounds.width.toFixed(3)} x ${modelReport.sourceBounds.height.toFixed(3)} x ${modelReport.sourceBounds.depth.toFixed(3)} units`,
    );
    addReportRow(
      'Displayed bounds (W x H x D)',
      `${modelReport.displayedBounds.width.toFixed(2)} x ${modelReport.displayedBounds.height.toFixed(2)} x ${modelReport.displayedBounds.depth.toFixed(2)} m`,
    );
    addReportRow('Applied scale / yaw', `${modelReport.appliedScale.toFixed(3)}x / ${modelReport.appliedYawDegrees.toFixed(0)} deg`);

    const clipNames = modelReport.clips;
    if (clipNames.length) {
      const requestedClip = previewQuery.get('clip');
      const initialClip = requestedClip && clipNames.includes(requestedClip) ? requestedClip : clipNames[0];
      clipSelect.replaceChildren(...clipNames.map((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        if (name === initialClip) option.selected = true;
        return option;
      }));
      clipSelect.disabled = false;
      if (!rig.playClip(initialClip)) throw new Error(`Could not play embedded clip "${initialClip}".`);
    } else {
      const option = document.createElement('option');
      option.textContent = 'No animation clips in this model';
      clipSelect.append(option);
    }

    const materialLines = modelReport.materials.length
      ? modelReport.materials.map((name) => `Material: ${name}`)
      : ['No materials found'];
    const textureLines = modelReport.textures.length
      ? modelReport.textures.map((texture) =>
        `${texture.material} / ${texture.slot}: ${texture.width}x${texture.height}`,
      )
      : ['No texture maps found'];
    const boneLines = modelReport.bones.length
      ? modelReport.bones.map((name) => `- ${name}`)
      : ['(none)'];
    details.textContent = [
      ...materialLines,
      '',
      'Texture maps:',
      ...textureLines.map((line) => `- ${line}`),
      '',
      'Skeleton bones:',
      ...boneLines,
      '',
      'Animation clips:',
      ...(clipNames.length ? clipNames.map((name) => `- ${name}`) : ['(none; no animation is synthesized)']),
    ].join('\n');

    if (modelReport.bones.length > 0) {
      skeletonHelper = new THREE.SkeletonHelper(rig.model);
      skeletonHelper.visible = skeletonControl.checked;
      scene.add(skeletonHelper);
      skeletonControl.disabled = false;
    } else {
      skeletonControl.checked = false;
      skeletonControl.disabled = true;
    }

    const animationMessage = clipNames.length
      ? `${clipNames.length} embedded clip${clipNames.length === 1 ? '' : 's'} available.`
      : 'This model has no embedded animation clips; it is displayed in its static pose.';
    setStatus(`Loaded ${config.label}. ${animationMessage}`, 'success');
  } catch (error) {
    console.error(`Monster preview failed for ${config.path}.`, error);
    if (sequence === loadSequence) {
      setStatus(`Could not load ${config.path}: ${error instanceof Error ? error.message : String(error)}`, 'error');
      details.textContent = 'Model load failed. Check the browser console and Network panel for the underlying error.';
    }
  }
}

modelSelect.addEventListener('change', () => { void loadSelectedModel(); });
clipSelect.addEventListener('change', () => {
  const clipName = clipSelect.value;
  if (!currentRig?.playClip(clipName)) {
    setStatus(`Could not play embedded clip "${clipName}".`, 'error');
  } else {
    setStatus(`Playing embedded clip: ${clipName}`, 'success');
  }
});
heightControl.addEventListener('input', () => {
  targetHeight = Number(heightControl.value);
  heightValue.value = `${targetHeight.toFixed(2)} m`;
  currentRig?.setTargetHeight(targetHeight);
});
yawControl.addEventListener('input', () => {
  const yaw = Number(yawControl.value);
  yawValue.value = `${yaw} deg`;
  currentRig?.setYawDegrees(yaw);
});
skeletonControl.addEventListener('change', () => {
  if (skeletonHelper) skeletonHelper.visible = skeletonControl.checked;
});
resetButton.addEventListener('click', () => {
  if (currentRig) {
    targetHeight = selectedConfig.targetHeight;
    heightControl.value = String(targetHeight);
    heightValue.value = `${targetHeight.toFixed(2)} m`;
    currentRig.setTargetHeight(targetHeight);
    const yaw = THREE.MathUtils.radToDeg(selectedConfig.rotationY ?? 0);
    yawControl.value = String(yaw);
    yawValue.value = `${yaw} deg`;
    currentRig.setYawDegrees(yaw);
  }
  if (currentRig) {
    controls.target.set(0, targetHeight * 0.48, 0);
    camera.position.set(targetHeight * 1.65, targetHeight * 1.1, targetHeight * 2.3);
    controls.update();
  }
});

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.05);
  currentRig?.update(delta, 0, false, false, false, false, false);
  controls.update();
  renderer.render(scene, camera);
});
window.addEventListener('resize', resize);
resize();
void loadSelectedModel();

window.addEventListener('beforeunload', () => {
  loadSequence++;
  window.removeEventListener('resize', resize);
  currentRig?.dispose();
  controls.dispose();
  assets.dispose();
  renderer.dispose();
});
