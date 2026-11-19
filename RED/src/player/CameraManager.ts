import * as THREE from 'three';

export class CameraManager {
  mode: 'third-person' | 'first-person' = 'third-person';
  yaw = 0;
  pitch = -0.12;
  private readonly offset = new THREE.Vector3();
  private readonly desiredPosition = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private cameraInitialized = false;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  toggle(): void {
    this.mode = this.mode === 'third-person' ? 'first-person' : 'third-person';
    this.cameraInitialized = false;
  }

  update(
    player: THREE.Group,
    lookX: number,
    lookY: number,
    delta: number,
    sensitivity = 0.003,
    eyeHeight = 1.48,
    targetHeight = 1.05,
  ): void {
    this.yaw -= lookX * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - lookY * sensitivity, -1.15, 0.65);
    player.rotation.y = this.yaw;
    player.visible = this.mode !== 'first-person';
    const height = this.mode === 'first-person' ? eyeHeight : targetHeight;
    this.lookTarget.set(player.position.x, player.position.y + height, player.position.z);
    if (this.mode === 'first-person') {
      this.camera.position.copy(this.lookTarget);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.cameraInitialized = false;
      return;
    }
    const distance = 6.8;
    this.offset.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch) * distance,
      2.45 - Math.sin(this.pitch) * distance,
      -Math.cos(this.yaw) * Math.cos(this.pitch) * distance,
    );
    this.desiredPosition.copy(this.lookTarget).add(this.offset);
    if (!this.cameraInitialized) {
      this.camera.position.copy(this.desiredPosition);
      this.cameraInitialized = true;
    } else {
      const smoothing = 1 - Math.exp(-12 * Math.max(0, delta));
      this.camera.position.lerp(this.desiredPosition, smoothing);
    }
    this.camera.lookAt(this.lookTarget);
  }
}
