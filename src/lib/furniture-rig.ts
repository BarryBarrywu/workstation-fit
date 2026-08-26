import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { versionedAssetPath } from './assets';
import type { MetricKey } from './ergonomics';

type FurnitureState = {
  deskHeight: number;
  seatHeight: number;
  monitorTop: number;
  postureMix: number;
};

const MONITOR_ARM_LENGTH = 0.40;
const CHAIR_GAS_MIN_TOP = 0.2175;

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

function solveTwoLink(base: THREE.Vector3, target: THREE.Vector3, length: number) {
  const delta = target.clone().sub(base);
  const vertical = delta.y;
  const horizontal = new THREE.Vector3(delta.x, 0, delta.z);
  const horizontalLength = horizontal.length();
  const reach = THREE.MathUtils.clamp(delta.length(), 0.001, length * 1.98);
  const along = reach / 2;
  const lift = Math.sqrt(Math.max(0, length * length - along * along));
  const horizontalDirection = horizontalLength
    ? horizontal.normalize()
    : new THREE.Vector3(1, 0, 0);
  const reachDirection = delta.clone().normalize();
  const perpendicular = new THREE.Vector3(
    -horizontalDirection.x * vertical / reach,
    horizontalLength / reach,
    -horizontalDirection.z * vertical / reach,
  );
  return base.clone().addScaledVector(reachDirection, along).addScaledVector(perpendicular, lift);
}

function placeRigidLink(link: THREE.Object3D, start: THREE.Vector3, end: THREE.Vector3) {
  const direction = end.clone().sub(start).normalize();
  link.position.copy(start).lerp(end, 0.5);
  link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
}

export async function createFurnitureRig(loader: GLTFLoader, sceneMeters: number, highlightColor: number) {
  const gltf = await loader.loadAsync(versionedAssetPath('/models/workstation-furniture.glb'));
  const model = gltf.scene;
  const object = new THREE.Group();
  object.rotation.y = Math.PI / 2;
  object.scale.setScalar(sceneMeters);
  object.add(model);

  const materials = {
    desk: [] as THREE.MeshStandardMaterial[],
    monitor: [] as THREE.MeshStandardMaterial[],
    chair: [] as THREE.MeshStandardMaterial[],
  };
  model.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const clones = (Array.isArray(node.material) ? node.material : [node.material])
      .map((material) => material.clone());
    node.material = Array.isArray(node.material) ? clones : clones[0];
    const ancestry = [];
    for (let ancestor: THREE.Object3D | null = node; ancestor; ancestor = ancestor.parent) {
      ancestry.push(ancestor.name);
    }
    const target = ancestry.includes('ChairRoot')
      ? materials.chair
      : node.name.startsWith('Monitor')
        ? materials.monitor
        : materials.desk;
    clones.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) target.push(material);
    });
  });

  const requiredNode = (name: string) => {
    const node = model.getObjectByName(name);
    if (!node) throw new Error(`Missing furniture node: ${name}`);
    return node;
  };
  const nodes = {
    deskTop: requiredNode('DeskTopAssembly'),
    deskMiddle: [requiredNode('DeskColumnMiddle_L'), requiredNode('DeskColumnMiddle_R')],
    deskUpper: [requiredNode('DeskColumnUpper_L'), requiredNode('DeskColumnUpper_R')],
    monitorClamp: requiredNode('MonitorClamp'),
    monitorClampJaw: requiredNode('MonitorClampJaw'),
    monitorLowerArm: requiredNode('MonitorLowerArm'),
    monitorUpperArm: requiredNode('MonitorUpperArm'),
    monitorPivots: [
      requiredNode('MonitorPivotBase'),
      requiredNode('MonitorPivotElbow'),
      requiredNode('MonitorPivotHead'),
    ],
    monitorScreen: requiredNode('MonitorScreen'),
    monitorPanel: requiredNode('MonitorPanel'),
    monitorVesa: requiredNode('MonitorVesaMount'),
    chair: requiredNode('ChairRoot'),
    chairUpper: requiredNode('ChairUpper'),
    chairGasMiddle: requiredNode('ChairGasMiddle'),
    chairGasInner: requiredNode('ChairGasInner'),
  };

  function setActiveMetric(metric: MetricKey) {
    const setHighlight = (target: THREE.MeshStandardMaterial[], emphasized: boolean) => {
      target.forEach((material) => {
        if (material.name === 'Furniture_Screen') return;
        material.emissive.setHex(emphasized ? highlightColor : 0x000000);
        material.emissiveIntensity = emphasized ? 0.16 : 0;
      });
    };
    setHighlight(materials.chair, metric === 'seat');
    setHighlight(materials.desk, metric === 'desk');
    setHighlight(materials.monitor, metric === 'monitor');
  }

  function update(state: FurnitureState) {
    const deskSurface = state.deskHeight / sceneMeters;
    const seatSurface = state.seatHeight / sceneMeters;
    const screenTop = state.monitorTop / sceneMeters;
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

    nodes.chair.position.x = lerp(0, -0.22, state.postureMix);
    nodes.chair.position.z = lerp(-0.288, -0.58, state.postureMix);
    nodes.chair.rotation.y = lerp(0, 0.26, state.postureMix);
    nodes.chairUpper.position.y = seatSurface - 0.0425;
    const gasTop = Math.max(CHAIR_GAS_MIN_TOP, nodes.chairUpper.position.y - 0.055);
    const gasExtension = gasTop - CHAIR_GAS_MIN_TOP;
    nodes.chairGasMiddle.position.y = 0.14 + Math.min(gasExtension, 0.13);
    nodes.chairGasInner.position.y = gasTop - 0.07;
  }

  return {
    object,
    setActiveMetric,
    update,
    seatMeasurementX: (postureMix: number) => lerp(-0.72, -1.45, postureMix),
  };
}
