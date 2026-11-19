import * as THREE from 'three';
import type { Race } from '../core/types';
import { actorToonMaterial, organicForm } from './ActorGeometry';

export interface CharacterRig {
  model: THREE.Group;
  update(
    delta: number,
    movement: number,
    sprinting: boolean,
    attacking: boolean,
    takingDamage: boolean,
    dead: boolean,
    blocking: boolean,
    jumping: boolean,
    attackSequence?: number,
  ): void;
  dispose?(): void;
}

interface RaceStyle {
  height: number;
  width: number;
  skin: number;
  cloth: number;
  armor: number;
  hair: number;
  cape: number;
}

const RACE_STYLE: Record<Race, RaceStyle> = {
  Human: { height: 1, width: 1, skin: 0xb77e58, cloth: 0x40584b, armor: 0x777d78, hair: 0x392b24, cape: 0x263e38 },
  Elf: { height: 1.07, width: 0.88, skin: 0xb98d72, cloth: 0x345348, armor: 0x9b8659, hair: 0x343b37, cape: 0x263d46 },
  Dwarf: { height: 0.78, width: 1.2, skin: 0xa96d4d, cloth: 0x68434a, armor: 0x74746b, hair: 0x6a3827, cape: 0x4c2930 },
  Beastkin: { height: 1.01, width: 1.04, skin: 0x8e684d, cloth: 0x635d38, armor: 0x786d50, hair: 0x574332, cape: 0x51412b },
};

function metalMaterial(color: number, roughness: number, metalness: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function mesh(
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  parent: THREE.Object3D,
  position: THREE.Vector3,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.copy(position);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function plateShape(width: number, height: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.44, height * 0.46);
  shape.quadraticCurveTo(0, height * 0.56, width * 0.44, height * 0.46);
  shape.lineTo(width * 0.5, height * 0.16);
  shape.quadraticCurveTo(width * 0.42, -height * 0.38, 0, -height * 0.5);
  shape.quadraticCurveTo(-width * 0.42, -height * 0.38, -width * 0.5, height * 0.16);
  shape.closePath();
  return shape;
}

export function createCharacterRig(race: Race): CharacterRig {
  const style = RACE_STYLE[race];
  const model = new THREE.Group();
  const rig = new THREE.Group();
  rig.scale.set(style.width, style.height, style.width);
  model.add(rig);

  const skin = actorToonMaterial(style.skin);
  const cloth = actorToonMaterial(style.cloth);
  const leather = actorToonMaterial(race === 'Elf' ? 0x463d2c : 0x3e3024);
  const armor = metalMaterial(style.armor, 0.38, 0.62);
  const trim = metalMaterial(race === 'Dwarf' ? 0xb48848 : 0xb59a62, 0.42, 0.55);
  const hair = actorToonMaterial(style.hair);
  const dark = actorToonMaterial(0x261d1a);
  const eye = actorToonMaterial(0xe5d6b8);
  const iris = actorToonMaterial(race === 'Elf' ? 0x76bd7b : race === 'Beastkin' ? 0xc28b46 : race === 'Dwarf' ? 0x9b6239 : 0x76513a);
  const pupil = actorToonMaterial(0x11110f);
  const glint = new THREE.MeshBasicMaterial({ color: 0xfff5dc });
  const lip = actorToonMaterial(race === 'Beastkin' ? 0x352723 : 0x70483b);
  let tailBone: THREE.Bone | null = null;
  let capeBone: THREE.Bone | null = null;

  const pelvis = new THREE.Bone();
  pelvis.name = 'Hips';
  pelvis.position.y = 0.88;
  rig.add(pelvis);
  mesh(organicForm(0.33, 0.28, 0.18, [0.74, 0.96, 1, 0.86, 0.62]), cloth, pelvis, new THREE.Vector3(0, 0.01, 0));

  const spine = new THREE.Bone();
  spine.name = 'Spine';
  spine.position.y = 0.12;
  pelvis.add(spine);
  mesh(organicForm(0.67, 0.28, 0.18, [0.67, 0.9, 1, 0.93, 0.82, 0.67]), cloth, spine, new THREE.Vector3(0, 0.22, 0));
  const chestPlate = mesh(
    new THREE.ExtrudeGeometry(plateShape(0.54, 0.64), { depth: 0.065, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.025, bevelThickness: 0.025 }),
    armor,
    spine,
    new THREE.Vector3(0, 0.22, 0.175),
  );
  chestPlate.rotation.x = -0.08;
  mesh(new THREE.TorusGeometry(0.21, 0.018, 6, 24), trim, spine, new THREE.Vector3(0, 0.22, 0.251)).scale.set(1, 1.1, 0.35);
  const chestSigil = mesh(new THREE.BoxGeometry(0.075, 0.1, 0.018), trim, spine, new THREE.Vector3(0, 0.22, 0.26));
  chestSigil.rotation.z = Math.PI / 4;
  for (const side of [-1, 1]) {
    const strap = mesh(new THREE.CapsuleGeometry(0.022, 0.36, 3, 7), leather, spine, new THREE.Vector3(side * 0.105, 0.23, 0.257));
    strap.rotation.z = side * -0.42;
    for (const y of [-0.13, 0.13]) {
      mesh(new THREE.SphereGeometry(0.016, 8, 6), trim, spine, new THREE.Vector3(side * (0.105 + y * 0.42), 0.23 + y, 0.281));
    }
  }
  const collar = mesh(new THREE.TorusGeometry(0.105, 0.025, 7, 18), leather, spine, new THREE.Vector3(0, 0.48, 0));
  collar.rotation.x = Math.PI / 2;
  const backEquipmentSocket = new THREE.Bone();
  backEquipmentSocket.name = 'Equipment_Back';
  backEquipmentSocket.position.set(0, 0.1, -0.2);
  spine.add(backEquipmentSocket);
  capeBone = new THREE.Bone();
  capeBone.name = 'Cape';
  capeBone.position.set(0, 0.38, -0.2);
  spine.add(capeBone);
  const capePositions: number[] = [];
  const capeIndices: number[] = [];
  const capeRows = 8;
  const capeColumns = 6;
  for (let row = 0; row <= capeRows; row++) {
    const t = row / capeRows;
    const width = THREE.MathUtils.lerp(0.2, 0.4, t);
    for (let column = 0; column <= capeColumns; column++) {
      const across = column / capeColumns * 2 - 1;
      capePositions.push(
        across * width,
        -t * 0.82,
        -t * 0.11 - Math.cos(across * Math.PI * 3) * Math.sin(t * Math.PI) * 0.025,
      );
      if (row < capeRows && column < capeColumns) {
        const current = row * (capeColumns + 1) + column;
        const next = current + capeColumns + 1;
        capeIndices.push(current, next, current + 1, next, next + 1, current + 1);
      }
    }
  }
  const capeGeometry = new THREE.BufferGeometry();
  capeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(capePositions, 3));
  capeGeometry.setIndex(capeIndices);
  capeGeometry.computeVertexNormals();
  const capeMaterial = actorToonMaterial(style.cape);
  capeMaterial.side = THREE.DoubleSide;
  const cape = new THREE.Mesh(capeGeometry, capeMaterial);
  cape.castShadow = true;
  cape.receiveShadow = true;
  capeBone.add(cape);

  const belt = mesh(new THREE.TorusGeometry(0.23, 0.038, 7, 24), leather, pelvis, new THREE.Vector3(0, 0.13, 0));
  belt.scale.set(1.13, 0.56, 0.72);
  const buckle = mesh(new THREE.BoxGeometry(0.11, 0.09, 0.035), trim, pelvis, new THREE.Vector3(0, 0.13, 0.245));
  buckle.rotation.z = Math.PI / 4;
  for (const side of [-1, 1]) {
    const pouch = mesh(new THREE.BoxGeometry(0.105, 0.12, 0.075), leather, pelvis, new THREE.Vector3(side * 0.22, 0.06, 0.2));
    pouch.rotation.z = side * -0.1;
    mesh(new THREE.BoxGeometry(0.11, 0.018, 0.012), trim, pelvis, new THREE.Vector3(side * 0.22, 0.12, 0.24));
  }
  for (const side of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.12, 0.44, 0.28), cloth, pelvis, new THREE.Vector3(side * 0.16, -0.17, 0.015));
    mesh(new THREE.BoxGeometry(0.035, 0.42, 0.035), trim, pelvis, new THREE.Vector3(side * 0.16, -0.17, 0.17));
  }

  const neck = new THREE.Bone();
  neck.name = 'Neck';
  neck.position.set(0, 0.59, 0);
  spine.add(neck);
  mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.18, 12), skin, neck, new THREE.Vector3(0, 0.01, 0));
  const head = new THREE.Bone();
  head.name = 'Head';
  head.position.y = 0.13;
  neck.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.19, 24, 18), skin, head, new THREE.Vector3(0, 0.03, 0));
  skull.scale.set(0.92, 1.08, 0.92);
  mesh(organicForm(0.15, 0.15, 0.135, [0.15, 0.72, 1, 0.94, 0.63]), skin, head, new THREE.Vector3(0, -0.07, 0.11));
  mesh(new THREE.SphereGeometry(0.055, 14, 10), skin, head, new THREE.Vector3(0, -0.005, 0.18));
  if (race === 'Beastkin') {
    const muzzle = mesh(organicForm(0.11, 0.105, 0.12, [0.35, 0.9, 1, 0.68]), actorToonMaterial(0x806454), head, new THREE.Vector3(0, -0.045, 0.205));
    muzzle.rotation.x = Math.PI / 2;
  }
  mesh(new THREE.BoxGeometry(0.11, 0.014, 0.012), lip, head, new THREE.Vector3(0, -0.105, race === 'Beastkin' ? 0.28 : 0.205));
  for (const side of [-1, 1]) {
    const nostril = mesh(new THREE.SphereGeometry(0.009, 8, 6), dark, head, new THREE.Vector3(side * 0.019, 0.004, race === 'Beastkin' ? 0.292 : 0.218));
    nostril.scale.set(1, 0.7, 0.65);
  }
  for (const side of [-1, 1]) {
    const socket = mesh(new THREE.SphereGeometry(0.05, 16, 12), dark, head, new THREE.Vector3(side * 0.075, 0.058, 0.148));
    socket.scale.set(1.12, 0.8, 0.55);
    mesh(new THREE.SphereGeometry(0.038, 16, 12), eye, head, new THREE.Vector3(side * 0.075, 0.058, 0.17));
    mesh(new THREE.SphereGeometry(0.022, 14, 12), iris, head, new THREE.Vector3(side * 0.075, 0.058, 0.197));
    mesh(new THREE.SphereGeometry(0.011, 10, 8), pupil, head, new THREE.Vector3(side * 0.075, 0.058, 0.211));
    mesh(new THREE.SphereGeometry(0.007, 8, 6), glint, head, new THREE.Vector3(side * 0.082, 0.068, 0.216));
    const brow = mesh(new THREE.CapsuleGeometry(0.016, 0.075, 3, 7), hair, head, new THREE.Vector3(side * 0.075, 0.103, 0.159));
    brow.rotation.z = side * -0.12;
    const ear = mesh(new THREE.SphereGeometry(0.055, 10, 8), skin, head, new THREE.Vector3(side * 0.19, 0.035, 0));
    ear.scale.set(0.42, 0.72, 0.8);
    if (race === 'Elf' || race === 'Beastkin') {
      const point = mesh(new THREE.ConeGeometry(race === 'Elf' ? 0.052 : 0.075, race === 'Elf' ? 0.25 : 0.2, 8), skin, head, new THREE.Vector3(side * 0.27, 0.075, 0));
      point.rotation.z = side * -Math.PI / 2;
      if (race === 'Beastkin') {
        const inner = mesh(new THREE.ConeGeometry(0.039, 0.115, 7), actorToonMaterial(0x76504a), head, new THREE.Vector3(side * 0.271, 0.068, 0.035));
        inner.rotation.z = side * -Math.PI / 2;
      }
    }
    if (race === 'Beastkin') {
      const cheek = mesh(new THREE.ConeGeometry(0.045, 0.13, 7), hair, head, new THREE.Vector3(side * 0.12, -0.085, 0.13));
      cheek.rotation.z = side * -Math.PI / 2;
      const fang = mesh(new THREE.ConeGeometry(0.012, 0.045, 7), eye, head, new THREE.Vector3(side * 0.045, -0.105, 0.286));
      fang.rotation.z = Math.PI;
    }
  }

  const hairCap = mesh(new THREE.SphereGeometry(0.195, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.53), hair, head, new THREE.Vector3(0, 0.11, -0.015));
  hairCap.scale.set(1.02, 0.9, 1.05);
  for (let i = -1; i <= 1; i++) {
    const fringe = mesh(new THREE.CapsuleGeometry(0.021, 0.065, 3, 7), hair, head, new THREE.Vector3(i * 0.055, 0.16 - Math.abs(i) * 0.012, 0.14));
    fringe.rotation.z = i * 0.24;
  }
  for (let i = 0; i < (race === 'Dwarf' ? 7 : 5); i++) {
    const lock = mesh(new THREE.CapsuleGeometry(0.025, 0.12 + (i % 3) * 0.035, 3, 6), hair, head, new THREE.Vector3((i - 2) * 0.045, 0.055, -0.13));
    lock.rotation.z = (i - 2) * 0.17;
  }
  if (race === 'Dwarf') {
    const beard = mesh(organicForm(0.29, 0.12, 0.09, [0.72, 1, 0.94, 0.68, 0.25]), hair, head, new THREE.Vector3(0, -0.15, 0.14));
    beard.rotation.x = -0.12;
    for (const side of [-1, 1]) {
      const braid = mesh(new THREE.CapsuleGeometry(0.025, 0.18, 3, 6), hair, head, new THREE.Vector3(side * 0.13, -0.12, 0.075));
      braid.rotation.z = side * -0.22;
      mesh(new THREE.TorusGeometry(0.027, 0.008, 5, 10), trim, head, new THREE.Vector3(side * 0.13, -0.22, 0.08));
    }
  }
  if (race === 'Beastkin') {
    for (let i = 0; i < 9; i++) {
      const tuft = mesh(new THREE.ConeGeometry(0.035, 0.12, 5), hair, head, new THREE.Vector3((i - 4) * 0.035, 0.04, 0.15));
      tuft.rotation.z = (i - 4) * 0.12;
    }
  }

  for (const side of [-1, 1]) {
    const shoulder = new THREE.Bone();
    shoulder.name = side < 0 ? 'LeftShoulder' : 'RightShoulder';
    shoulder.position.set(side * 0.29, 0.48, 0);
    spine.add(shoulder);
    mesh(new THREE.SphereGeometry(0.14, 14, 12), cloth, shoulder, new THREE.Vector3(0, -0.03, 0));
    const pauldron = mesh(new THREE.SphereGeometry(0.15, 16, 12), armor, shoulder, new THREE.Vector3(side * 0.035, 0.015, 0.015));
    pauldron.scale.set(1.14, 0.68, 1.12);
    mesh(new THREE.TorusGeometry(0.105, 0.012, 5, 16), trim, shoulder, new THREE.Vector3(side * 0.035, -0.01, 0.07)).scale.set(1, 0.78, 0.55);
    for (const rivetSide of [-1, 1]) {
      mesh(new THREE.SphereGeometry(0.014, 8, 6), trim, shoulder, new THREE.Vector3(side * 0.09, -0.04, rivetSide * 0.065 + 0.09));
    }
    const upperArm = new THREE.Bone();
    upperArm.name = side < 0 ? 'LeftUpperArm' : 'RightUpperArm';
    upperArm.position.y = -0.09;
    shoulder.add(upperArm);
    mesh(organicForm(0.31, 0.09, 0.09, [0.77, 1, 0.94, 0.72]), cloth, upperArm, new THREE.Vector3(0, -0.13, 0));
    const elbow = new THREE.Bone();
    elbow.name = side < 0 ? 'LeftLowerArm' : 'RightLowerArm';
    elbow.position.y = -0.29;
    upperArm.add(elbow);
    mesh(new THREE.SphereGeometry(0.075, 10, 8), skin, elbow, new THREE.Vector3(0, 0, 0));
    mesh(organicForm(0.29, 0.075, 0.08, [0.75, 0.98, 1, 0.7]), armor, elbow, new THREE.Vector3(0, -0.13, 0.01));
    const bracer = mesh(new THREE.CylinderGeometry(0.082, 0.095, 0.13, 12, 1, true), leather, elbow, new THREE.Vector3(0, -0.21, 0.01));
    bracer.rotation.z = side * 0.04;
    mesh(new THREE.TorusGeometry(0.088, 0.012, 5, 16), trim, elbow, new THREE.Vector3(0, -0.15, 0.01));
    mesh(new THREE.TorusGeometry(0.086, 0.008, 5, 16), trim, elbow, new THREE.Vector3(0, -0.27, 0.01));
    const hand = new THREE.Bone();
    hand.name = side < 0 ? 'LeftHand' : 'RightHand';
    hand.position.y = -0.3;
    elbow.add(hand);
    mesh(new THREE.SphereGeometry(0.065, 12, 10), skin, hand, new THREE.Vector3(0, 0, 0.02));
    for (let finger = 0; finger < 4; finger++) {
      const digit = mesh(new THREE.CapsuleGeometry(0.012, 0.055, 3, 5), skin, hand, new THREE.Vector3((finger - 1.5) * 0.026, -0.045, 0.035));
      digit.rotation.z = (finger - 1.5) * 0.08;
    }
    if (side === 1) {
      const weaponSocket = new THREE.Bone();
      weaponSocket.name = 'WeaponSocket';
      weaponSocket.position.set(0, -0.05, 0.045);
      hand.add(weaponSocket);
      const grip = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.17, 8), leather, weaponSocket, new THREE.Vector3(0, -0.03, 0));
      grip.rotation.z = -0.36;
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(-0.035, 0);
      bladeShape.lineTo(-0.075, -0.16);
      bladeShape.lineTo(-0.06, -0.58);
      bladeShape.lineTo(0, -0.78);
      bladeShape.lineTo(0.06, -0.58);
      bladeShape.lineTo(0.075, -0.16);
      bladeShape.lineTo(0.035, 0);
      bladeShape.closePath();
      const blade = mesh(
        new THREE.ExtrudeGeometry(bladeShape, { depth: 0.028, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.012, bevelThickness: 0.012 }),
        armor,
        weaponSocket,
        new THREE.Vector3(0, -0.1, -0.014),
      );
      blade.rotation.z = -0.36;
      mesh(new THREE.BoxGeometry(0.22, 0.045, 0.065), trim, weaponSocket, new THREE.Vector3(0, -0.11, 0)).rotation.z = -0.36;
      const fuller = mesh(new THREE.BoxGeometry(0.018, 0.48, 0.008), trim, weaponSocket, new THREE.Vector3(0, -0.4, 0.032));
      fuller.rotation.z = -0.36;
      mesh(new THREE.SphereGeometry(0.045, 8, 8), trim, weaponSocket, new THREE.Vector3(0, 0.065, 0));
    } else {
      mesh(new THREE.BoxGeometry(0.12, 0.045, 0.055), leather, hand, new THREE.Vector3(0, -0.09, 0));
    }

    const hip = new THREE.Bone();
    hip.name = side < 0 ? 'LeftUpperLeg' : 'RightUpperLeg';
    hip.position.set(side * 0.16, -0.12, 0);
    pelvis.add(hip);
    mesh(organicForm(0.36, 0.095, 0.105, [0.82, 1, 0.94, 0.65]), cloth, hip, new THREE.Vector3(0, -0.16, 0));
    const knee = new THREE.Bone();
    knee.name = side < 0 ? 'LeftLowerLeg' : 'RightLowerLeg';
    knee.position.y = -0.32;
    hip.add(knee);
    mesh(new THREE.SphereGeometry(0.075, 10, 8), armor, knee, new THREE.Vector3(0, 0, 0.015));
    mesh(organicForm(0.34, 0.075, 0.085, [0.72, 0.94, 1, 0.71]), cloth, knee, new THREE.Vector3(0, -0.16, 0));
    const boot = new THREE.Bone();
    boot.name = side < 0 ? 'LeftFoot' : 'RightFoot';
    boot.position.set(0, -0.34, 0.045);
    knee.add(boot);
    const bootMesh = mesh(new THREE.CapsuleGeometry(0.09, 0.18, 4, 8), leather, boot, new THREE.Vector3(0, -0.045, 0.035));
    bootMesh.scale.set(1, 0.75, 1.35);
    mesh(new THREE.BoxGeometry(0.18, 0.045, 0.28), armor, boot, new THREE.Vector3(0, -0.12, 0.075));

    if (race === 'Dwarf') {
      hip.scale.y = 0.88;
      shoulder.scale.set(1.12, 1.08, 1.1);
    }
  }
  if (race === 'Beastkin') {
    const tail = new THREE.Bone();
    tail.name = 'Tail';
    tailBone = tail;
    tail.position.set(0, 0.86, -0.14);
    tail.rotation.x = -0.55;
    rig.add(tail);
    mesh(organicForm(0.58, 0.09, 0.09, [0.66, 0.8, 0.7, 0.48, 0.25]), hair, tail, new THREE.Vector3(0, -0.25, 0));
    const tailTip = mesh(new THREE.SphereGeometry(0.105, 12, 10), actorToonMaterial(0xdbc2a1), tail, new THREE.Vector3(0, -0.52, 0));
    tailTip.scale.set(1, 1.25, 1);
  }

  let elapsed = 0;
  let attackTime = 0;
  let damageTime = 0;
  let movementBlend = 0;
  let sprintBlend = 0;
  let blockBlend = 0;
  let jumpBlend = 0;
  let attackSequence = 0;
  return {
    model,
    update(delta, movement, sprinting, attacking, takingDamage, dead, blocking, jumping, sequence = 0) {
      elapsed += delta;
      if (attacking) {
        attackTime = 0.42;
        attackSequence = sequence % 3;
      }
      if (takingDamage) damageTime = 0.22;
      attackTime = Math.max(0, attackTime - delta);
      damageTime = Math.max(0, damageTime - delta);
      movementBlend = THREE.MathUtils.damp(movementBlend, Math.min(1, movement), 9, delta);
      sprintBlend = THREE.MathUtils.damp(sprintBlend, sprinting ? 1 : 0, 8, delta);
      blockBlend = THREE.MathUtils.damp(blockBlend, blocking ? 1 : 0, 12, delta);
      jumpBlend = THREE.MathUtils.damp(jumpBlend, jumping ? 1 : 0, 9, delta);
      const gait = elapsed * THREE.MathUtils.lerp(8, 12, sprintBlend);
      const stride = movementBlend * THREE.MathUtils.lerp(0.5, 0.78, sprintBlend);
      for (let i = 0; i < pelvis.children.length; i++) {
        const child = pelvis.children[i];
        if (child instanceof THREE.Bone && child !== spine) {
          const side = child.position.x < 0 ? -1 : 1;
          const gaitPose = Math.sin(gait + (side < 0 ? 0 : Math.PI)) * stride;
          child.rotation.x = THREE.MathUtils.lerp(gaitPose, -0.42, jumpBlend);
          const knee = child.children.find((part) => part instanceof THREE.Bone);
          if (knee instanceof THREE.Bone) {
            const kneePose = Math.max(0, Math.sin(gait + (side < 0 ? 0 : Math.PI))) * stride * 0.72;
            knee.rotation.x = THREE.MathUtils.lerp(kneePose, 0.58, jumpBlend);
          }
        }
      }
      const dying = dead ? 1 : 0;
      spine.rotation.z = (Math.sin(gait) * stride * 0.045) - blockBlend * 0.06
        + (damageTime > 0 ? Math.sin((damageTime / 0.22) * Math.PI) * 0.2 : 0);
      spine.rotation.x = -blockBlend * 0.08 + jumpBlend * 0.14;
      spine.position.y = 0.12 + (movementBlend > 0.05 ? Math.abs(Math.sin(gait * 2)) * (0.018 + sprintBlend * 0.017) : Math.sin(elapsed * 1.8) * 0.008);
      if (tailBone) {
        tailBone.rotation.x = -0.55 + Math.sin(elapsed * 2.8) * 0.18;
        tailBone.rotation.z = Math.sin(elapsed * 2.1) * 0.16;
      }
      if (capeBone) {
        capeBone.rotation.x = -0.08 - sprintBlend * 0.18 + Math.sin(elapsed * 5 + stride) * movementBlend * 0.06;
        capeBone.rotation.z = Math.sin(elapsed * 3.2) * (0.025 + sprintBlend * 0.04);
      }
      rig.rotation.z = THREE.MathUtils.damp(rig.rotation.z, dying * -1.15, 5, delta);
      rig.position.y = THREE.MathUtils.damp(rig.position.y, dying * -0.05, 5, delta);
      const shoulders = spine.children.filter((child) => child instanceof THREE.Bone && child !== neck) as THREE.Bone[];
      shoulders.forEach((shoulder) => {
        const side = shoulder.position.x < 0 ? -1 : 1;
        const upperArm = shoulder.children.find((part) => part instanceof THREE.Bone);
        if (!(upperArm instanceof THREE.Bone)) return;
        const elbow = upperArm.children.find((part) => part instanceof THREE.Bone);
        const attack = attackTime > 0 && side > 0;
        const swing = -Math.sin(gait + (side < 0 ? 0 : Math.PI)) * stride * 0.55;
        const guarded = THREE.MathUtils.lerp(THREE.MathUtils.lerp(swing, -1.05, blockBlend), -0.55, jumpBlend);
        const attackProgress = 1 - attackTime / 0.42;
        const windupX = attackSequence === 2 ? -2.05 : -1.45;
        const windupZ = attackSequence === 1 ? 1.2 : 0.75;
        const followX = attackSequence === 2 ? 1.05 : 0.55;
        const followZ = attackSequence === 1 ? -1.25 : -0.8;
        let attackX: number;
        let attackZ: number;
        if (attackProgress < 0.32) {
          const windup = attackProgress / 0.32;
          attackX = THREE.MathUtils.lerp(-0.35, windupX, windup);
          attackZ = THREE.MathUtils.lerp(0.12, windupZ, windup);
        } else if (attackProgress < 0.7) {
          const slash = (attackProgress - 0.32) / 0.38;
          attackX = THREE.MathUtils.lerp(windupX, followX, slash);
          attackZ = THREE.MathUtils.lerp(windupZ, followZ, slash);
        } else {
          const recovery = (attackProgress - 0.7) / 0.3;
          attackX = THREE.MathUtils.lerp(followX, 0.1, recovery);
          attackZ = THREE.MathUtils.lerp(followZ, 0, recovery);
        }
        upperArm.rotation.x = dead ? 0.9 : attack ? attackX : guarded;
        upperArm.rotation.z = attack ? attackZ : side * (0.42 * blockBlend + 0.12 * jumpBlend);
        if (elbow instanceof THREE.Bone) {
          const elbowAttack = attackProgress < 0.32 ? -0.8 : attackProgress < 0.7 ? 0.35 : 0.1;
          elbow.rotation.x = attack ? elbowAttack : -0.68 * blockBlend + 0.15 * jumpBlend;
        }
      });
    },
  };
}
