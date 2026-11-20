import * as THREE from 'three';
import type { CreatureKind } from '../core/types';
import { actorMaterial, consolidateActorMeshes, longitudinalLoft, sweptTube, verticalLoft } from './ActorGeometry';

export interface CreatureRig {
  model: THREE.Group;
  update(
    delta: number,
    movement: number,
    running: boolean,
    attacking: boolean,
    takingDamage: boolean,
    dead: boolean,
    special: boolean,
  ): void;
  dispose?(): void;
}

interface QuadrupedLeg {
  hip: THREE.Bone;
  knee: THREE.Bone;
  ankle: THREE.Bone;
  phase: number;
  front: boolean;
}

function addMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  parent: THREE.Object3D,
  position: THREE.Vector3,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.position.copy(position);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function makeEarGeometry(width: number, height: number, rounded: boolean): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.48, -height * 0.35);
  shape.quadraticCurveTo(-width * 0.52, height * 0.12, -width * 0.2, height * 0.43);
  if (rounded) {
    shape.quadraticCurveTo(0, height * 0.54, width * 0.2, height * 0.43);
    shape.quadraticCurveTo(width * 0.52, height * 0.12, width * 0.48, -height * 0.35);
  } else {
    shape.quadraticCurveTo(width * 0.05, height * 0.32, width * 0.22, height * 0.02);
    shape.quadraticCurveTo(width * 0.44, -height * 0.16, width * 0.48, -height * 0.35);
  }
  shape.quadraticCurveTo(0, -height * 0.49, -width * 0.48, -height * 0.35);
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.025,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.006,
    curveSegments: 8,
  });
}

function makeBodySections(kind: CreatureKind, length: number): Array<{ position: number; width: number; depth: number; offset: number }> {
  const scale = kind === 'bear' ? 1.16 : kind === 'deer' ? 0.78 : 1;
  const shoulder = kind === 'bear' ? 0.28 : kind === 'deer' ? 0.16 : 0.19;
  const waist = kind === 'bear' ? 0.23 : kind === 'deer' ? 0.145 : 0.16;
  return [
    { position: -length * 0.55, width: 0.035 * scale, depth: 0.045 * scale, offset: 0.015 },
    { position: -length * 0.46, width: waist * 0.75, depth: 0.13 * scale, offset: 0.01 },
    { position: -length * 0.28, width: waist, depth: 0.17 * scale, offset: 0.015 },
    { position: -length * 0.06, width: waist * 0.92, depth: 0.16 * scale, offset: 0.025 },
    { position: length * 0.16, width: shoulder * 0.85, depth: 0.18 * scale, offset: 0.045 },
    { position: length * 0.34, width: shoulder, depth: 0.205 * scale, offset: 0.055 },
    { position: length * 0.48, width: shoulder * 0.78, depth: 0.15 * scale, offset: 0.065 },
    { position: length * 0.55, width: 0.04 * scale, depth: 0.055 * scale, offset: 0.055 },
  ];
}

function makeMuzzle(kind: CreatureKind): THREE.BufferGeometry {
  if (kind === 'wolf') {
    return longitudinalLoft([
      { position: 0.12, width: 0.115, depth: 0.105, offset: -0.035 },
      { position: 0.21, width: 0.095, depth: 0.085, offset: -0.055 },
      { position: 0.34, width: 0.064, depth: 0.057, offset: -0.07 },
      { position: 0.43, width: 0.035, depth: 0.036, offset: -0.07 },
    ]);
  }
  if (kind === 'bear') {
    return longitudinalLoft([
      { position: 0.15, width: 0.145, depth: 0.13, offset: -0.035 },
      { position: 0.23, width: 0.16, depth: 0.14, offset: -0.065 },
      { position: 0.33, width: 0.135, depth: 0.11, offset: -0.075 },
      { position: 0.39, width: 0.085, depth: 0.075, offset: -0.07 },
    ]);
  }
  return longitudinalLoft([
    { position: 0.12, width: 0.105, depth: 0.09, offset: -0.025 },
    { position: 0.22, width: 0.075, depth: 0.065, offset: -0.04 },
    { position: 0.34, width: 0.045, depth: 0.045, offset: -0.05 },
    { position: 0.42, width: 0.026, depth: 0.032, offset: -0.05 },
  ]);
}

export function createCreatureRig(
  kind: CreatureKind,
  coat: THREE.Material,
): CreatureRig {
  const model = new THREE.Group();
  const rig = new THREE.Group();
  model.add(rig);
  if (kind === 'bear') rig.scale.setScalar(1.15);

  const baseColor = coat instanceof THREE.MeshStandardMaterial ? coat.color : new THREE.Color(0x77776b);
  const fur = actorMaterial(baseColor, 'fur');
  const darkCoat = actorMaterial(kind === 'wolf' ? 0x48483f : kind === 'deer' ? 0x6e4a31 : 0x30231e, 'fur');
  const lightCoat = actorMaterial(kind === 'wolf' ? 0xaaa18a : kind === 'deer' ? 0xc3a77a : 0x79614b, 'fur');
  const hoof = actorMaterial(kind === 'deer' ? 0x302a23 : 0x29251f, 'leather');
  const antler = actorMaterial(0x514433, 'bone');
  const eyeWhite = actorMaterial(kind === 'wolf' ? 0x9e8a68 : 0xc9bca1, 'bone');
  const iris = new THREE.MeshStandardMaterial({ color: kind === 'wolf' ? 0x8c572e : 0x735332, roughness: 0.3 });
  const pupil = new THREE.MeshStandardMaterial({ color: 0x11110f, roughness: 0.18 });
  const eyeGlint = new THREE.MeshBasicMaterial({ color: 0xfff0cf });
  const noseMaterial = actorMaterial(kind === 'bear' ? 0x201c1a : 0x25231f, 'leather');
  const bodyLength = kind === 'bear' ? 1.12 : kind === 'deer' ? 0.76 : 1;
  const shoulderHeight = kind === 'bear' ? 0.93 : kind === 'deer' ? 0.88 : 0.75;
  const legLength = kind === 'bear' ? 0.52 : kind === 'deer' ? 0.47 : 0.42;
  const bodyCenter = shoulderHeight - (kind === 'bear' ? 0.18 : 0.17);
  const frontZ = kind === 'bear' ? 0.36 : kind === 'deer' ? 0.29 : 0.34;
  const rearZ = -bodyLength * 0.42;

  addMesh(
    longitudinalLoft(makeBodySections(kind, bodyLength)),
    fur,
    rig,
    new THREE.Vector3(0, bodyCenter, 0),
  );

  if (kind === 'deer') {
    addMesh(
      longitudinalLoft([
        { position: -bodyLength * 0.26, width: 0.08, depth: 0.075, offset: -0.12 },
        { position: -bodyLength * 0.08, width: 0.11, depth: 0.09, offset: -0.13 },
        { position: bodyLength * 0.18, width: 0.12, depth: 0.09, offset: -0.12 },
        { position: bodyLength * 0.32, width: 0.07, depth: 0.065, offset: -0.1 },
      ]),
      lightCoat,
      rig,
      new THREE.Vector3(0, bodyCenter, 0),
    );
  }

  if (kind === 'bear') {
    const shoulderMantle = addMesh(
      longitudinalLoft([
        { position: 0.02, width: 0.19, depth: 0.17, offset: 0.11 },
        { position: 0.16, width: 0.27, depth: 0.23, offset: 0.12 },
        { position: 0.34, width: 0.25, depth: 0.22, offset: 0.12 },
        { position: 0.47, width: 0.15, depth: 0.14, offset: 0.1 },
      ]),
      darkCoat,
      rig,
      new THREE.Vector3(0, bodyCenter, 0),
    );
    shoulderMantle.rotation.x = -0.04;
  }

  const neck = new THREE.Bone();
  neck.name = 'Neck';
  neck.position.set(0, shoulderHeight - 0.04, bodyLength * 0.35);
  neck.rotation.x = kind === 'deer' ? -0.48 : kind === 'bear' ? -0.14 : -0.27;
  rig.add(neck);
  addMesh(
    longitudinalLoft([
      { position: -0.13, width: kind === 'bear' ? 0.18 : 0.115, depth: kind === 'bear' ? 0.18 : 0.12, offset: 0 },
      { position: 0.01, width: kind === 'deer' ? 0.105 : 0.15, depth: kind === 'bear' ? 0.2 : 0.14, offset: 0.025 },
      { position: 0.18, width: kind === 'bear' ? 0.15 : 0.12, depth: kind === 'bear' ? 0.18 : 0.12, offset: 0.05 },
      { position: 0.34, width: kind === 'deer' ? 0.085 : 0.11, depth: kind === 'bear' ? 0.14 : 0.105, offset: 0.075 },
    ]),
    fur,
    neck,
    new THREE.Vector3(0, 0, 0),
  );

  const head = new THREE.Bone();
  head.name = 'Head';
  head.position.set(0, kind === 'deer' ? 0.16 : 0.1, kind === 'deer' ? 0.23 : 0.22);
  neck.add(head);
  const headWidth = kind === 'bear' ? 0.22 : kind === 'deer' ? 0.135 : 0.16;
  const headHeight = kind === 'bear' ? 0.18 : kind === 'deer' ? 0.13 : 0.14;
  addMesh(
    longitudinalLoft([
      { position: -0.13, width: headWidth * 0.56, depth: headHeight * 0.58, offset: 0.005 },
      { position: -0.045, width: headWidth * 0.9, depth: headHeight * 0.9, offset: 0.015 },
      { position: 0.055, width: headWidth, depth: headHeight, offset: 0.02 },
      { position: 0.14, width: headWidth * 0.82, depth: headHeight * 0.78, offset: 0.015 },
      { position: 0.2, width: headWidth * 0.44, depth: headHeight * 0.47, offset: 0.005 },
    ]),
    fur,
    head,
    new THREE.Vector3(0, 0, 0),
  );
  addMesh(makeMuzzle(kind), kind === 'bear' ? darkCoat : kind === 'deer' ? lightCoat : fur, head, new THREE.Vector3());
  if (kind === 'wolf') {
    addMesh(
      longitudinalLoft([
        { position: 0.12, width: 0.085, depth: 0.035, offset: -0.105 },
        { position: 0.24, width: 0.072, depth: 0.04, offset: -0.115 },
        { position: 0.36, width: 0.045, depth: 0.03, offset: -0.105 },
      ]),
      lightCoat,
      head,
      new THREE.Vector3(),
    );
  }
  addMesh(
    longitudinalLoft([
      { position: kind === 'bear' ? 0.3 : 0.39, width: 0.058, depth: 0.043, offset: -0.065 },
      { position: kind === 'bear' ? 0.36 : 0.45, width: 0.046, depth: 0.036, offset: -0.065 },
    ]),
    noseMaterial,
    head,
    new THREE.Vector3(),
  );
  addMesh(
    longitudinalLoft([
      { position: 0.15, width: kind === 'bear' ? 0.1 : 0.06, depth: 0.032, offset: -0.115 },
      { position: 0.28, width: kind === 'bear' ? 0.08 : 0.045, depth: 0.025, offset: -0.12 },
      { position: 0.34, width: 0.03, depth: 0.02, offset: -0.105 },
    ]),
    lightCoat,
    head,
    new THREE.Vector3(),
  );

  for (const side of [-1, 1]) {
    const eyeX = side * (kind === 'bear' ? 0.14 : kind === 'deer' ? 0.088 : 0.105);
    const eyeY = kind === 'bear' ? 0.07 : 0.06;
    const eyeZ = kind === 'bear' ? 0.095 : 0.115;
    const socket = addMesh(new THREE.SphereGeometry(0.048, 16, 12), darkCoat, head, new THREE.Vector3(eyeX, eyeY, eyeZ));
    socket.scale.set(1.05, 0.82, 0.58);
    addMesh(new THREE.SphereGeometry(0.032, 16, 12), eyeWhite, head, new THREE.Vector3(eyeX, eyeY, eyeZ + 0.022));
    addMesh(new THREE.SphereGeometry(0.021, 14, 10), iris, head, new THREE.Vector3(eyeX, eyeY, eyeZ + 0.041));
    addMesh(new THREE.SphereGeometry(0.011, 10, 8), pupil, head, new THREE.Vector3(eyeX, eyeY, eyeZ + 0.055));
    addMesh(new THREE.SphereGeometry(0.005, 8, 6), eyeGlint, head, new THREE.Vector3(eyeX - side * 0.004, eyeY + 0.006, eyeZ + 0.06));

    const earWidth = kind === 'bear' ? 0.12 : kind === 'deer' ? 0.13 : 0.105;
    const earHeight = kind === 'bear' ? 0.15 : kind === 'deer' ? 0.19 : 0.2;
    const ear = addMesh(
      makeEarGeometry(earWidth, earHeight, kind === 'bear'),
      fur,
      head,
      new THREE.Vector3(side * (kind === 'bear' ? 0.16 : 0.12), kind === 'bear' ? 0.17 : 0.16, -0.025),
    );
    ear.rotation.z = kind === 'deer' ? side * -0.68 : side * -0.12;
    ear.rotation.y = side * -0.12;
    const inner = addMesh(
      makeEarGeometry(earWidth * 0.52, earHeight * 0.63, kind === 'bear'),
      lightCoat,
      head,
      new THREE.Vector3(side * (kind === 'bear' ? 0.16 : 0.12), kind === 'bear' ? 0.17 : 0.16, 0.006),
    );
    inner.rotation.copy(ear.rotation);

    if (kind === 'deer') {
      const antlerPoints = [
        new THREE.Vector3(side * 0.08, 0.15, 0),
        new THREE.Vector3(side * 0.12, 0.27, -0.01),
        new THREE.Vector3(side * 0.18, 0.4, -0.015),
        new THREE.Vector3(side * 0.19, 0.55, -0.02),
      ];
      addMesh(sweptTube(antlerPoints, 0.025, 20, 7), antler, head, new THREE.Vector3());
      for (const branch of [-1, 1]) {
        addMesh(sweptTube([
          new THREE.Vector3(side * 0.155, 0.34, -0.015),
          new THREE.Vector3(side * (0.18 + branch * 0.045), 0.4, -0.015),
          new THREE.Vector3(side * (0.2 + branch * 0.055), 0.49 + (branch > 0 ? 0.04 : 0), -0.02),
        ], 0.013, 12, 6), antler, head, new THREE.Vector3());
      }
    }
  }

  if (kind === 'wolf') {
    const ruff = actorMaterial(0x514f47, 'fur');
    for (let tuft = -2; tuft <= 2; tuft++) {
      const x = tuft * 0.07;
      addMesh(sweptTube([
        new THREE.Vector3(x, shoulderHeight - bodyCenter + 0.18, 0.24),
        new THREE.Vector3(x * 1.1, shoulderHeight - bodyCenter + 0.03, 0.3),
        new THREE.Vector3(x * 0.95, shoulderHeight - bodyCenter - 0.12, 0.32),
      ], 0.032, 14, 7), ruff, rig, new THREE.Vector3());
    }
  }

  const legs: QuadrupedLeg[] = [];
  for (const side of [-1, 1]) {
    for (const front of [true, false]) {
      const z = front ? frontZ : rearZ;
      const hip = new THREE.Bone();
      hip.name = `${front ? 'Front' : 'Rear'}${side < 0 ? 'Left' : 'Right'}UpperLeg`;
      const footClearance = kind === 'deer' ? 0.08 : 0.13;
      const legRootHeight = legLength * 0.95 + footClearance;
      hip.position.set(side * (kind === 'bear' ? 0.25 : kind === 'wolf' ? 0.16 : 0.19), legRootHeight, z);
      rig.add(hip);
      addMesh(verticalLoft([
        { position: -legLength * 0.62, width: kind === 'bear' ? 0.105 : 0.06, depth: kind === 'bear' ? 0.11 : 0.065 },
        { position: -legLength * 0.42, width: kind === 'bear' ? 0.12 : 0.072, depth: kind === 'bear' ? 0.13 : 0.08 },
        { position: -legLength * 0.17, width: kind === 'bear' ? 0.15 : 0.095, depth: kind === 'bear' ? 0.15 : 0.105 },
        { position: -0.015, width: kind === 'bear' ? 0.13 : 0.08, depth: kind === 'bear' ? 0.14 : 0.09 },
      ]), fur, hip, new THREE.Vector3());

      const knee = new THREE.Bone();
      knee.name = `${front ? 'Front' : 'Rear'}${side < 0 ? 'Left' : 'Right'}LowerLeg`;
      knee.position.y = -legLength * 0.58;
      hip.add(knee);
      addMesh(verticalLoft([
        { position: -legLength * 0.43, width: kind === 'bear' ? 0.09 : 0.052, depth: kind === 'bear' ? 0.095 : 0.056 },
        { position: -legLength * 0.3, width: kind === 'bear' ? 0.1 : 0.061, depth: kind === 'bear' ? 0.11 : 0.067 },
        { position: -legLength * 0.1, width: kind === 'bear' ? 0.085 : 0.054, depth: kind === 'bear' ? 0.09 : 0.061 },
        { position: 0, width: kind === 'bear' ? 0.08 : 0.05, depth: kind === 'bear' ? 0.09 : 0.057 },
      ]), fur, knee, new THREE.Vector3());

      const ankle = new THREE.Bone();
      ankle.name = `${front ? 'Front' : 'Rear'}${side < 0 ? 'Left' : 'Right'}Paw`;
      ankle.position.set(0, -legLength * 0.37, 0.035);
      knee.add(ankle);
      if (kind === 'deer') {
        for (const half of [-1, 1]) {
          addMesh(verticalLoft([
            { position: -0.075, width: 0.018, depth: 0.025 },
            { position: -0.045, width: 0.022, depth: 0.03 },
            { position: 0.02, width: 0.025, depth: 0.035 },
          ]), hoof, ankle, new THREE.Vector3(half * 0.018, 0, 0.04));
        }
      } else {
        addMesh(longitudinalLoft([
          { position: -0.055, width: kind === 'bear' ? 0.085 : 0.06, depth: 0.055, offset: -0.025 },
          { position: 0.025, width: kind === 'bear' ? 0.12 : 0.082, depth: 0.075, offset: -0.03 },
          { position: 0.12, width: kind === 'bear' ? 0.11 : 0.075, depth: 0.065, offset: -0.04 },
          { position: 0.17, width: 0.04, depth: 0.035, offset: -0.045 },
        ]), darkCoat, ankle, new THREE.Vector3(0, -0.025, 0.04));
        const toeCount = kind === 'bear' ? 4 : 3;
        for (let toe = 0; toe < toeCount; toe++) {
          const x = (toe - (toeCount - 1) / 2) * (kind === 'bear' ? 0.045 : 0.035);
          addMesh(longitudinalLoft([
            { position: 0.105, width: 0.009, depth: 0.01, offset: -0.042 },
            { position: 0.15, width: 0.013, depth: 0.014, offset: -0.046 },
            { position: 0.205, width: 0.003, depth: 0.005, offset: -0.05 },
          ]), hoof, ankle, new THREE.Vector3(x, -0.015, 0.04));
        }
      }
      const diagonal = (front && side < 0) || (!front && side > 0);
      legs.push({ hip, knee, ankle, phase: diagonal ? 0 : Math.PI, front });
    }
  }

  const tailLength = kind === 'bear' ? 0.19 : kind === 'deer' ? 0.31 : 0.48;
  const tail = new THREE.Bone();
  tail.name = 'Tail';
  tail.position.set(0, bodyCenter - 0.02, -bodyLength * 0.49);
  tail.rotation.x = kind === 'deer' ? -0.25 : 0.42;
  rig.add(tail);
  const tailBones: THREE.Bone[] = [];
  const tailSegments = kind === 'bear' ? 2 : 3;
  for (let index = 0; index < tailSegments; index++) {
    const segmentLength = tailLength / tailSegments;
    const segment = index === 0 ? tail : new THREE.Bone();
    segment.name = index === 0 ? 'Tail' : `Tail${index + 1}`;
    if (index > 0) {
      segment.position.z = -segmentLength;
      tailBones[index - 1].add(segment);
    }
    addMesh(longitudinalLoft([
      { position: -segmentLength, width: 0.012, depth: 0.012, offset: -0.01 },
      { position: -segmentLength * 0.7, width: 0.026, depth: 0.025, offset: 0 },
      { position: -segmentLength * 0.3, width: 0.034, depth: 0.032, offset: 0.005 },
      { position: 0, width: index === 0 ? 0.045 : 0.035, depth: 0.04, offset: 0.01 },
    ]), kind === 'deer' ? lightCoat : fur, segment, new THREE.Vector3());
    tailBones.push(segment);
  }

  consolidateActorMeshes(model);

  const baseColors = new Map<THREE.MeshStandardMaterial, THREE.Color>();
  const hitTint = new THREE.Color(0xff3d35);
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const surfaces = Array.isArray(object.material) ? object.material : [object.material];
    for (const surface of surfaces) {
      if (surface instanceof THREE.MeshStandardMaterial) baseColors.set(surface, surface.color.clone());
    }
  });

  let elapsed = Math.random() * Math.PI * 2;
  let movementBlend = 0;
  let attackTime = 0;
  let specialAttackTime = 0;
  let damageTime = 0;
  return {
    model,
    update(delta, movement, running, attacking, takingDamage, dead, special) {
      elapsed += delta;
      movementBlend = THREE.MathUtils.damp(movementBlend, Math.min(1, movement), 8, delta);
      if (attacking) {
        attackTime = special ? 0.72 : 0.46;
        if (special) specialAttackTime = 0.72;
      }
      if (takingDamage) damageTime = 0.24;
      attackTime = Math.max(0, attackTime - delta);
      specialAttackTime = Math.max(0, specialAttackTime - delta);
      damageTime = Math.max(0, damageTime - delta);
      const hitFlash = Math.min(1, damageTime / 0.16);
      for (const [surface, color] of baseColors) surface.color.copy(color).lerp(hitTint, hitFlash * 0.78);

      const gaitSpeed = running ? 10.5 : 6.8;
      const stride = movementBlend * (running ? 0.62 : 0.34);
      for (const leg of legs) {
        const phase = elapsed * gaitSpeed + leg.phase;
        const pounce = kind === 'wolf' && attackTime > 0 && leg.front;
        const swipe = specialAttackTime > 0 && leg.front;
        const reach = pounce ? -0.72 : swipe ? -0.92 : Math.sin(phase) * stride;
        leg.hip.rotation.x = THREE.MathUtils.damp(leg.hip.rotation.x, reach, 12, delta);
        const flex = Math.max(0, Math.sin(phase + (leg.front ? 0.65 : -0.35))) * stride * (kind === 'deer' ? 0.9 : 0.72);
        leg.knee.rotation.x = THREE.MathUtils.damp(leg.knee.rotation.x, flex + (pounce ? 0.62 : swipe ? 0.35 : 0), 12, delta);
        leg.ankle.rotation.x = Math.sin(phase + Math.PI) * stride * 0.22 - flex * 0.18;
      }

      tailBones.forEach((bone, index) => {
        const phase = elapsed * (kind === 'deer' ? 2.4 : 2.9) - index * 0.52;
        bone.rotation.x = (kind === 'deer' ? -0.22 : 0.28) + Math.sin(phase) * (movementBlend > 0.05 ? 0.25 : 0.15);
        bone.rotation.y = Math.sin(phase * 0.72) * (kind === 'wolf' ? 0.2 : 0.11);
      });
      head.rotation.x = attackTime > 0
        ? specialAttackTime > 0 ? -0.5 : 0.25
        : damageTime > 0 ? -0.2 : Math.sin(elapsed * 1.35) * (movementBlend > 0.05 ? 0.045 : 0.022);
      head.rotation.y = Math.sin(elapsed * 0.62) * 0.025;
      neck.rotation.x = (kind === 'deer' ? -0.48 : kind === 'bear' ? -0.14 : -0.27)
        - movementBlend * 0.04 + Math.sin(elapsed * 1.8) * 0.018;

      if (dead) {
        rig.rotation.z = THREE.MathUtils.damp(rig.rotation.z, 1.1, 4, delta);
        rig.position.y = THREE.MathUtils.damp(rig.position.y, -0.28, 4, delta);
      } else {
        rig.rotation.z = THREE.MathUtils.damp(rig.rotation.z, damageTime > 0 ? -0.17 : 0, 7, delta);
        rig.position.y = THREE.MathUtils.damp(
          rig.position.y,
          movementBlend > 0.05
            ? Math.abs(Math.sin(elapsed * gaitSpeed * 2)) * (running ? 0.045 : 0.022)
            : Math.sin(elapsed * 2) * 0.008,
          9,
          delta,
        );
        rig.position.z = kind === 'wolf' && attackTime > 0
          ? Math.sin((attackTime / 0.46) * Math.PI) * 0.12
          : 0;
      }
    },
  };
}
