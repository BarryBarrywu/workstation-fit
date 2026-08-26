import * as THREE from 'three';
import type { MetricKey, Posture, ResultKey, WorkstationResult } from '../../src/lib/ergonomics';

type EncodedAccessor = {
  componentType: 5121 | 5123 | 5125 | 5126;
  count: number;
  itemSize: number;
  normalized: boolean;
  data: string;
};
type EncodedModel = {
  roots: number[];
  materials: Array<{ name: string; color: number[]; metalness: number; roughness: number; emissive: number[]; doubleSided: boolean }>;
  meshes: Array<{ name: string; primitives: Array<{ position: EncodedAccessor; normal: EncodedAccessor | null; indices: EncodedAccessor | null; material: number | null }> }>;
  nodes: Array<{ name: string; mesh: number | null; children: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[] }>;
};
type ModelPayload = { robot: EncodedModel; furniture: EncodedModel };
type SceneState = { height: number; posture: Posture; selected: ResultKey; result: WorkstationResult };

declare global {
  interface Window { __JIUWEI_MODEL_DATA__?: ModelPayload }
}

const CM = 0.025;
const MODEL_HEIGHT = 1.754;
const MODEL_HIP_HEIGHT = 0.974;
const MODEL_SHIN_LENGTH = 0.415;
const MODEL_ANKLE_TO_SOLE = 0.134;
const MONITOR_ARM_LENGTH = 0.40;
const CHAIR_GAS_MIN_TOP = 0.2175;
const amber = 0xd5913d;
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

function decodeAccessor(accessor: EncodedAccessor) {
  const binary = atob(accessor.data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const arrays = {
    5121: Uint8Array,
    5123: Uint16Array,
    5125: Uint32Array,
    5126: Float32Array,
  } as const;
  const TypedArray = arrays[accessor.componentType];
  return new THREE.BufferAttribute(new TypedArray(bytes.buffer), accessor.itemSize, accessor.normalized);
}

function makeMaterial(source: EncodedModel['materials'][number] | undefined) {
  const color = source?.color ?? [0.7, 0.72, 0.69, 1];
  const material = new THREE.MeshStandardMaterial({
    name: source?.name ?? '',
    color: new THREE.Color(color[0], color[1], color[2]),
    metalness: Math.min(source?.metalness ?? 0.1, 0.72),
    roughness: Math.max(source?.roughness ?? 0.65, 0.3),
    transparent: color[3] < 1,
    opacity: color[3],
    side: source?.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (source?.emissive) material.emissive.setRGB(source.emissive[0], source.emissive[1], source.emissive[2]);
  if (material.name === 'Furniture_Screen') {
    material.color.setHex(0x93a589);
    material.emissive.setHex(0x26352b);
    material.emissiveIntensity = 0.22;
  }
  return material;
}

function buildModel(data: EncodedModel) {
  const nodes = data.nodes.map((source) => {
    const node = new THREE.Group();
    node.name = source.name;
    if (source.matrix) {
      node.matrix.fromArray(source.matrix);
      node.matrix.decompose(node.position, node.quaternion, node.scale);
    } else {
      if (source.translation) node.position.fromArray(source.translation);
      if (source.rotation) node.quaternion.fromArray(source.rotation);
      if (source.scale) node.scale.fromArray(source.scale);
    }
    if (source.mesh !== null) {
      const meshData = data.meshes[source.mesh];
      meshData.primitives.forEach((primitive, index) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', decodeAccessor(primitive.position));
        if (primitive.normal) geometry.setAttribute('normal', decodeAccessor(primitive.normal));
        else geometry.computeVertexNormals();
        if (primitive.indices) geometry.setIndex(decodeAccessor(primitive.indices));
        const mesh = new THREE.Mesh(geometry, makeMaterial(primitive.material === null ? undefined : data.materials[primitive.material]));
        mesh.name = meshData.primitives.length === 1 ? `${source.name}Mesh` : `${source.name}Mesh${index + 1}`;
        node.add(mesh);
      });
    }
    return node;
  });
  data.nodes.forEach((source, index) => source.children.forEach((child) => nodes[index].add(nodes[child])));
  const root = new THREE.Group();
  data.roots.forEach((index) => root.add(nodes[index]));
  return root;
}

function requiredNode(model: THREE.Object3D, name: string) {
  const node = model.getObjectByName(name);
  if (!node) throw new Error(`Missing model node: ${name}`);
  return node;
}

function solveTwoLink(base: THREE.Vector3, target: THREE.Vector3, length: number) {
  const delta = target.clone().sub(base);
  const vertical = delta.y;
  const horizontal = new THREE.Vector3(delta.x, 0, delta.z);
  const horizontalLength = horizontal.length();
  const reach = THREE.MathUtils.clamp(delta.length(), 0.001, length * 1.98);
  const horizontalDirection = horizontalLength ? horizontal.normalize() : new THREE.Vector3(1, 0, 0);
  const reachDirection = delta.clone().normalize();
  const perpendicular = new THREE.Vector3(-horizontalDirection.x * vertical / reach, horizontalLength / reach, -horizontalDirection.z * vertical / reach);
  return base.clone().addScaledVector(reachDirection, reach / 2).addScaledVector(perpendicular, Math.sqrt(Math.max(0, length * length - reach * reach / 4)));
}

function placeRigidLink(link: THREE.Object3D, start: THREE.Vector3, end: THREE.Vector3) {
  const direction = end.clone().sub(start).normalize();
  link.position.copy(start).lerp(end, 0.5);
  link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
}

function createFurnitureRig(model: THREE.Object3D) {
  const object = new THREE.Group();
  object.rotation.y = Math.PI / 2;
  object.scale.setScalar(CM * 100);
  object.add(model);
  const materials = { desk: [] as THREE.MeshStandardMaterial[], monitor: [] as THREE.MeshStandardMaterial[], chair: [] as THREE.MeshStandardMaterial[] };
  model.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !(node.material instanceof THREE.MeshStandardMaterial)) return;
    const ancestry: string[] = [];
    for (let ancestor: THREE.Object3D | null = node; ancestor; ancestor = ancestor.parent) ancestry.push(ancestor.name);
    const target = ancestry.includes('ChairRoot') ? materials.chair : ancestry.some((name) => name.startsWith('Monitor')) ? materials.monitor : materials.desk;
    target.push(node.material);
  });
  const nodes = {
    deskTop: requiredNode(model, 'DeskTopAssembly'),
    deskMiddle: [requiredNode(model, 'DeskColumnMiddle_L'), requiredNode(model, 'DeskColumnMiddle_R')],
    deskUpper: [requiredNode(model, 'DeskColumnUpper_L'), requiredNode(model, 'DeskColumnUpper_R')],
    monitorClamp: requiredNode(model, 'MonitorClamp'),
    monitorClampJaw: requiredNode(model, 'MonitorClampJaw'),
    monitorLowerArm: requiredNode(model, 'MonitorLowerArm'),
    monitorUpperArm: requiredNode(model, 'MonitorUpperArm'),
    monitorPivots: [requiredNode(model, 'MonitorPivotBase'), requiredNode(model, 'MonitorPivotElbow'), requiredNode(model, 'MonitorPivotHead')],
    monitorScreen: requiredNode(model, 'MonitorScreen'),
    monitorPanel: requiredNode(model, 'MonitorPanel'),
    monitorVesa: requiredNode(model, 'MonitorVesaMount'),
    chair: requiredNode(model, 'ChairRoot'),
    chairUpper: requiredNode(model, 'ChairUpper'),
    chairGasMiddle: requiredNode(model, 'ChairGasMiddle'),
    chairGasInner: requiredNode(model, 'ChairGasInner'),
  };
  return {
    object,
    setActiveMetric(metric: MetricKey) {
      const highlight = (targets: THREE.MeshStandardMaterial[], active: boolean) => targets.forEach((material) => {
        if (material.name === 'Furniture_Screen') return;
        material.emissive.setHex(active ? amber : 0x000000);
        material.emissiveIntensity = active ? 0.16 : 0;
      });
      highlight(materials.chair, metric === 'seat');
      highlight(materials.desk, metric === 'desk');
      highlight(materials.monitor, metric === 'monitor');
    },
    update(deskHeight: number, seatHeight: number, monitorTop: number, postureMix: number) {
      const sceneMeters = CM * 100;
      const deskSurface = deskHeight / sceneMeters;
      const seatSurface = seatHeight / sceneMeters;
      const screenTop = monitorTop / sceneMeters;
      const upperColumnCenter = deskSurface - 0.28;
      const middleColumnCenter = lerp(0.28, upperColumnCenter, 0.5);
      nodes.deskTop.position.y = deskSurface - 0.015;
      nodes.deskMiddle.forEach((column) => { column.position.y = middleColumnCenter; });
      nodes.deskUpper.forEach((column) => { column.position.y = upperColumnCenter; });
      const basePoint = new THREE.Vector3(0.20, deskSurface + 0.06, 0.285);
      const screenPoint = new THREE.Vector3(0, screenTop - 0.18, 0.16);
      const mountPoint = screenPoint.clone().add(new THREE.Vector3(0, 0, 0.07));
      const elbowPoint = solveTwoLink(basePoint, mountPoint, MONITOR_ARM_LENGTH);
      nodes.monitorClamp.position.y = deskSurface - 0.01;
      nodes.monitorClampJaw.position.y = deskSurface - 0.105;
      placeRigidLink(nodes.monitorLowerArm, basePoint, elbowPoint);
      placeRigidLink(nodes.monitorUpperArm, elbowPoint, mountPoint);
      nodes.monitorPivots[0].position.copy(basePoint);
      nodes.monitorPivots[1].position.copy(elbowPoint);
      nodes.monitorPivots[2].position.copy(mountPoint);
      nodes.monitorScreen.position.copy(screenPoint);
      nodes.monitorPanel.position.set(0, screenPoint.y, screenPoint.z - 0.025);
      nodes.monitorVesa.position.set(0, screenPoint.y, screenPoint.z + 0.042);
      nodes.chair.position.x = lerp(0, -0.22, postureMix);
      nodes.chair.position.z = lerp(-0.288, -0.58, postureMix);
      nodes.chairUpper.position.y = seatSurface - 0.438;
      const gasTop = Math.max(CHAIR_GAS_MIN_TOP, nodes.chairUpper.position.y - 0.055);
      const gasExtension = gasTop - CHAIR_GAS_MIN_TOP;
      nodes.chairGasMiddle.position.y = 0.14 + Math.min(gasExtension, 0.13);
      nodes.chairGasInner.position.y = gasTop - 0.07;
    },
  };
}

function metricFor(key: ResultKey): MetricKey {
  if (key === 'seat') return 'seat';
  if (key === 'monitorDistance') return 'distance';
  return key.includes('Desk') ? 'desk' : 'monitor';
}

export function createFixedWorkstationScene(stage: HTMLElement, canvas: HTMLCanvasElement) {
  const payload = window.__JIUWEI_MODEL_DATA__;
  if (!payload) throw new Error('Missing model payload');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
  camera.position.set(7.4, 4.45, 8.4);
  camera.lookAt(0.2, 1.85, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7f8b82, 2.1));
  const light = new THREE.DirectionalLight(0xfff4df, 2.6);
  light.position.set(-4, 8, 5);
  scene.add(light);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.35, 0.2, 32), new THREE.MeshStandardMaterial({ color: 0xdce3dc, roughness: 0.9 }));
  plinth.position.y = -0.13;
  scene.add(plinth);

  const robotModel = buildModel(payload.robot);
  robotModel.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
    if (object.material.name === 'Shell_Accent') object.material.color.setHex(0x657169);
  });
  const robot = new THREE.Group();
  robot.rotation.y = Math.PI / 2;
  robot.add(robotModel);
  scene.add(robot);
  const furniture = createFurnitureRig(buildModel(payload.furniture));
  scene.add(furniture.object);
  const poseNodes = {
    hips: [requiredNode(robotModel, 'Hip_L'), requiredNode(robotModel, 'Hip_R')],
    knees: [requiredNode(robotModel, 'Knee_L'), requiredNode(robotModel, 'Knee_R')],
    ankles: [requiredNode(robotModel, 'Ankle_L'), requiredNode(robotModel, 'Ankle_R')],
    shoulders: [requiredNode(robotModel, 'Shoulder_L'), requiredNode(robotModel, 'Shoulder_R')],
    elbows: [requiredNode(robotModel, 'Elbow_L'), requiredNode(robotModel, 'Elbow_R')],
  };
  let target: SceneState | null = null;
  let postureMix = 0;
  let deskHeight = 1.7;
  let seatHeight = 1.05;
  let monitorTop = 3;
  let frame = 0;
  let previous = performance.now();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.fov = width < 360 ? 50 : 46;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();

  function updateRobot(height: number) {
    const scale = height * CM / MODEL_HEIGHT;
    const seatedAmount = 1 - postureMix;
    const hipTargetHeight = seatHeight + 0.13;
    robot.scale.setScalar(scale);
    robot.position.set(lerp(-0.78, -0.68, postureMix), lerp(hipTargetHeight - MODEL_HIP_HEIGHT * scale, 0, postureMix), 0);
    const hipAngle = -Math.PI / 2 * seatedAmount;
    const calfAngle = Math.acos(THREE.MathUtils.clamp((hipTargetHeight / scale - MODEL_ANKLE_TO_SOLE) / MODEL_SHIN_LENGTH, 0.15, 0.98)) * seatedAmount;
    poseNodes.hips.forEach((node) => { node.rotation.x = hipAngle; });
    poseNodes.knees.forEach((node) => { node.rotation.x = calfAngle - hipAngle; });
    poseNodes.ankles.forEach((node) => { node.rotation.x = -calfAngle; });
    const shoulderWorldY = robot.position.y + 1.439 * scale;
    const forward = Math.max(0.12, 0.05 - robot.position.x);
    const downward = Math.max(0.08, shoulderWorldY - deskHeight - 0.07);
    const arm = 0.305 * scale;
    const reach = THREE.MathUtils.clamp(Math.hypot(forward, downward), 0.001, arm * 1.92);
    const direction = Math.atan2(forward, downward);
    const shoulderOffset = Math.acos(THREE.MathUtils.clamp(reach / (2 * arm), -1, 1));
    const shoulderAngle = -(direction - shoulderOffset);
    const elbowAngle = -Math.acos(THREE.MathUtils.clamp((reach * reach - 2 * arm * arm) / (2 * arm * arm), -1, 1));
    poseNodes.shoulders.forEach((node) => { node.rotation.x = shoulderAngle; });
    poseNodes.elbows.forEach((node) => { node.rotation.x = elbowAngle; });
  }

  function render(now: number) {
    if (target) {
      const delta = Math.min((now - previous) / 1000, 0.05);
      const smoothing = reduceMotion.matches ? 1 : 1 - Math.pow(0.0008, delta);
      const postureTarget = target.posture === 'standing' ? 1 : 0;
      postureMix = lerp(postureMix, postureTarget, smoothing);
      deskHeight = lerp(deskHeight, (target.posture === 'sitting' ? target.result.sittingDesk.reference : target.result.standingDesk.reference) * CM, smoothing);
      seatHeight = lerp(seatHeight, target.result.seat.reference * CM, smoothing);
      monitorTop = lerp(monitorTop, (target.posture === 'sitting' ? target.result.sittingMonitorTop.reference : target.result.standingMonitorTop.reference) * CM, smoothing);
      furniture.update(deskHeight, seatHeight, monitorTop, postureMix);
      updateRobot(target.height);
      renderer.render(scene, camera);
      canvas.dataset.ready = 'true';
    }
    previous = now;
    frame = requestAnimationFrame(render);
  }
  frame = requestAnimationFrame(render);

  return {
    update(state: SceneState) {
      target = state;
      furniture.setActiveMetric(metricFor(state.selected));
      canvas.dataset.camera = 'fixed';
      canvas.dataset.posture = state.posture;
      canvas.dataset.selected = state.selected;
      canvas.dataset.height = String(state.height);
      canvas.dataset.motion = reduceMotion.matches ? 'reduced' : 'animated';
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
    },
  };
}
