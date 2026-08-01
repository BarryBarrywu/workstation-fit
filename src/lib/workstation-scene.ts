import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { MetricKey, Posture, WorkstationResult } from './ergonomics';

type SceneState = {
  height: number;
  posture: Posture;
  activeMetric: MetricKey;
  result: WorkstationResult;
};

type MetricVisual = {
  line: THREE.Line;
  capStart: THREE.Line;
  capEnd: THREE.Line;
  label: HTMLDivElement;
  anchor: THREE.Vector3;
};

const CM = 0.025;
const graphite = 0x202522;
const amber = 0xd5913d;
const MODEL_HEIGHT = 1.754;
const MODEL_HIP_HEIGHT = 0.974;
const MODEL_SHIN_LENGTH = 0.415;
const MODEL_ANKLE_TO_SOLE = 0.134;

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

function makeLine(color = graphite) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(0, 1, 0),
  ]);
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true }));
}

function setLine(line: THREE.Line, start: THREE.Vector3, end: THREE.Vector3) {
  line.geometry.setFromPoints([start, end]);
}

function createMetricVisual(stage: HTMLElement, key: MetricKey): MetricVisual {
  const label = document.createElement('div');
  label.className = 'dimension-label';
  label.dataset.metric = key;
  stage.append(label);

  const line = makeLine();
  const capStart = makeLine();
  const capEnd = makeLine();
  return { line, capStart, capEnd, label, anchor: new THREE.Vector3() };
}

export async function createWorkstationScene(stage: HTMLElement, canvas: HTMLCanvasElement) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xeef2f0, 9, 15);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  camera.position.set(7.1, 4.7, 8.2);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const environment = new RoomEnvironment();
  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  const environmentMap = environmentGenerator.fromScene(environment).texture;
  scene.environment = environmentMap;
  scene.environmentIntensity = 0.72;
  environmentGenerator.dispose();
  environment.dispose();

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 7;
  controls.maxDistance = 12;
  controls.minPolarAngle = 0.68;
  controls.maxPolarAngle = 1.48;
  controls.target.set(0, 2.05, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x89948d, 1.45));
  const keyLight = new THREE.DirectionalLight(0xfff4df, 2.35);
  keyLight.position.set(-4, 8, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xbdd1c5, 0.85);
  rimLight.position.set(5, 5, -5);
  scene.add(rimLight);

  const furnitureMaterial = new THREE.MeshStandardMaterial({ color: 0xb9c0bb, roughness: 0.72, metalness: 0.12 });
  const furnitureDark = new THREE.MeshStandardMaterial({ color: 0x49514c, roughness: 0.6, metalness: 0.34 });
  const screenMaterial = new THREE.MeshStandardMaterial({ color: 0x26302c, roughness: 0.42, metalness: 0.2 });
  const deskSurfaceMaterial = furnitureMaterial.clone();
  const deskFrameMaterial = furnitureDark.clone();
  const chairSurfaceMaterial = furnitureMaterial.clone();
  const chairFrameMaterial = furnitureDark.clone();
  const monitorSurfaceMaterial = screenMaterial.clone();

  const stageMaterial = new THREE.MeshStandardMaterial({ color: 0xdde3df, roughness: 0.86, metalness: 0.04 });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(3.15, 3.4, 0.28, 64), stageMaterial);
  plinth.position.y = -0.16;
  plinth.receiveShadow = true;
  scene.add(plinth);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.82, 0.012, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0xaeb7b1, transparent: true, opacity: 0.66 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.005;
  scene.add(ring);

  const desk = new THREE.Group();
  const deskTop = new THREE.Mesh(new RoundedBoxGeometry(2.45, 0.13, 1.35, 4, 0.06), deskSurfaceMaterial);
  deskTop.castShadow = true;
  desk.add(deskTop);
  const deskLegs = [-0.82, 0.82].map((x) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 1, 16), deskFrameMaterial);
    leg.position.x = x;
    leg.castShadow = true;
    desk.add(leg);
    return leg;
  });
  desk.position.x = 0.7;
  scene.add(desk);

  const monitor = new THREE.Group();
  const display = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.74, 1.18, 5, 0.07), monitorSurfaceMaterial);
  display.castShadow = true;
  monitor.add(display);
  const monitorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.02, 0.59),
    new THREE.MeshBasicMaterial({ color: 0xa9beb2, transparent: true, opacity: 0.76 }),
  );
  monitorGlow.rotation.y = -Math.PI / 2;
  monitorGlow.position.x = -0.063;
  monitor.add(monitorGlow);
  const monitorNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.42, 12), furnitureDark);
  monitorNeck.position.y = -0.55;
  monitor.add(monitorNeck);
  const monitorFoot = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.045, 0.42, 3, 0.02), furnitureDark);
  monitorFoot.position.y = -0.77;
  monitor.add(monitorFoot);
  monitor.position.x = 1.05;
  scene.add(monitor);

  const chair = new THREE.Group();
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.88, 0.14, 0.82, 5, 0.08), chairFrameMaterial);
  seat.castShadow = true;
  chair.add(seat);
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.16, 1.25, 0.82, 5, 0.08), chairSurfaceMaterial);
  back.position.set(-0.39, 0.62, 0);
  back.rotation.z = -0.12;
  back.castShadow = true;
  chair.add(back);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1, 16), chairFrameMaterial);
  chair.add(column);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.1, 0.08, 5), chairFrameMaterial);
  base.position.y = -0.56;
  chair.add(base);
  chair.position.x = -0.72;
  scene.add(chair);

  const robot = new THREE.Group();
  robot.rotation.y = Math.PI / 2;
  scene.add(robot);

  const gltf = await new GLTFLoader().loadAsync('/models/workstation-guide.glb');
  const robotModel = gltf.scene;
  robotModel.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial) || material.name !== 'Shell_Accent') return;
      material.color.setHex(0x657169);
      material.roughness = 0.58;
      material.metalness = 0.24;
    });
  });
  robot.add(robotModel);

  const requiredNode = (name: string) => {
    const node = robotModel.getObjectByName(name);
    if (!node) throw new Error(`Missing robot node: ${name}`);
    return node;
  };
  const poseNodes = {
    hips: [requiredNode('Hip_L'), requiredNode('Hip_R')],
    knees: [requiredNode('Knee_L'), requiredNode('Knee_R')],
    ankles: [requiredNode('Ankle_L'), requiredNode('Ankle_R')],
    shoulders: [requiredNode('Shoulder_L'), requiredNode('Shoulder_R')],
    elbows: [requiredNode('Elbow_L'), requiredNode('Elbow_R')],
  };

  const metricVisuals = {
    seat: createMetricVisual(stage, 'seat'),
    desk: createMetricVisual(stage, 'desk'),
    monitor: createMetricVisual(stage, 'monitor'),
    distance: createMetricVisual(stage, 'distance'),
  } satisfies Record<MetricKey, MetricVisual>;
  Object.values(metricVisuals).forEach((visual) => scene.add(visual.line, visual.capStart, visual.capEnd));

  let targetState: SceneState;
  let postureMix = 0;
  let deskHeight = 1.7;
  let seatHeight = 1.05;
  let monitorTop = 3;
  let activeMetric: MetricKey = 'desk';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function update(state: SceneState) {
    targetState = state;
    activeMetric = state.activeMetric;
    for (const [key, visual] of Object.entries(metricVisuals) as [MetricKey, MetricVisual][]) {
      const emphasized = key === state.activeMetric;
      visual.label.classList.toggle('is-active', emphasized);
      for (const line of [visual.line, visual.capStart, visual.capEnd]) {
        const material = line.material as THREE.LineBasicMaterial;
        material.color.setHex(emphasized ? amber : graphite);
        material.opacity = emphasized ? 0.95 : 0.2;
      }
    }
    const setHighlight = (materials: THREE.MeshStandardMaterial[], emphasized: boolean) => {
      materials.forEach((material) => {
        material.emissive.setHex(emphasized ? amber : 0x000000);
        material.emissiveIntensity = emphasized ? 0.16 : 0;
      });
    };
    setHighlight([chairSurfaceMaterial, chairFrameMaterial], state.activeMetric === 'seat');
    setHighlight([deskSurfaceMaterial, deskFrameMaterial], state.activeMetric === 'desk');
    setHighlight([monitorSurfaceMaterial], state.activeMetric === 'monitor');
  }

  function updateRobot(humanHeight: number) {
    const scale = (humanHeight * CM) / MODEL_HEIGHT;
    const seatedAmount = 1 - postureMix;
    const hipTargetHeight = seatHeight + 0.13;
    const seatedRootY = hipTargetHeight - MODEL_HIP_HEIGHT * scale;
    robot.scale.setScalar(scale);
    robot.position.set(
      lerp(-0.78, -0.68, postureMix),
      lerp(seatedRootY, 0, postureMix),
      0,
    );

    const seatedHipAngle = -Math.PI / 2;
    const calfCosine = THREE.MathUtils.clamp(
      (hipTargetHeight / scale - MODEL_ANKLE_TO_SOLE) / MODEL_SHIN_LENGTH,
      0.15,
      0.98,
    );
    const seatedCalfAngle = Math.acos(calfCosine);
    const hipAngle = seatedHipAngle * seatedAmount;
    const calfAngle = seatedCalfAngle * seatedAmount;
    const kneeAngle = calfAngle - hipAngle;
    const ankleAngle = -calfAngle;
    poseNodes.hips.forEach((node) => { node.rotation.x = hipAngle; });
    poseNodes.knees.forEach((node) => { node.rotation.x = kneeAngle; });
    poseNodes.ankles.forEach((node) => { node.rotation.x = ankleAngle; });

    const shoulderWorldY = robot.position.y + 1.439 * scale;
    const shoulderWorldX = robot.position.x;
    const targetX = 0.05;
    const targetY = deskHeight + 0.07;
    const forward = Math.max(0.12, targetX - shoulderWorldX);
    const downward = Math.max(0.08, shoulderWorldY - targetY);
    const upperArm = 0.305 * scale;
    const forearm = 0.305 * scale;
    const reach = THREE.MathUtils.clamp(
      Math.hypot(forward, downward),
      Math.abs(upperArm - forearm) + 0.001,
      (upperArm + forearm) * 0.96,
    );
    const direction = Math.atan2(forward, downward);
    const shoulderOffset = Math.acos(THREE.MathUtils.clamp(
      (upperArm * upperArm + reach * reach - forearm * forearm) / (2 * upperArm * reach),
      -1,
      1,
    ));
    const shoulderAngle = -(direction - shoulderOffset);
    const elbowAngle = -Math.acos(THREE.MathUtils.clamp(
      (reach * reach - upperArm * upperArm - forearm * forearm) / (2 * upperArm * forearm),
      -1,
      1,
    ));
    poseNodes.shoulders.forEach((node) => { node.rotation.x = shoulderAngle; });
    poseNodes.elbows.forEach((node) => { node.rotation.x = elbowAngle; });
  }

  function updateFurniture() {
    deskTop.position.y = deskHeight;
    deskLegs.forEach((leg) => {
      leg.scale.y = deskHeight - 0.05;
      leg.position.y = (deskHeight - 0.05) / 2;
    });
    monitor.position.y = monitorTop - 0.37;
    chair.position.y = seatHeight;
    chair.position.x = lerp(-0.72, -1.85, postureMix);
    chair.rotation.y = lerp(0, -0.34, postureMix);
    column.scale.y = Math.max(0.35, seatHeight - 0.3);
    column.position.y = -(seatHeight - 0.3) / 2 - 0.1;
  }

  function updateMeasurements(state: SceneState) {
    const cap = 0.11;
    const seatX = chair.position.x - 0.72;
    const deskX = 2.12;
    const monitorX = 1.62;
    const measurements: Record<MetricKey, { start: THREE.Vector3; end: THREE.Vector3; text: string }> = {
      seat: {
        start: new THREE.Vector3(seatX, 0.02, -0.72),
        end: new THREE.Vector3(seatX, seatHeight, -0.72),
        text: `${Math.round(state.result.seat.min)}–${Math.round(state.result.seat.max)} cm`,
      },
      desk: {
        start: new THREE.Vector3(deskX, 0.02, -0.72),
        end: new THREE.Vector3(deskX, deskHeight, -0.72),
        text: `${Math.round((state.posture === 'sitting' ? state.result.sittingDesk : state.result.standingDesk).min)}–${Math.round((state.posture === 'sitting' ? state.result.sittingDesk : state.result.standingDesk).max)} cm`,
      },
      monitor: {
        start: new THREE.Vector3(monitorX, 0.02, 0.73),
        end: new THREE.Vector3(monitorX, monitorTop, 0.73),
        text: `${Math.round((state.posture === 'sitting' ? state.result.sittingMonitorTop : state.result.standingMonitorTop).min)}–${Math.round((state.posture === 'sitting' ? state.result.sittingMonitorTop : state.result.standingMonitorTop).max)} cm`,
      },
      distance: {
        start: new THREE.Vector3(-0.42, monitorTop - 0.45, 0),
        end: new THREE.Vector3(0.95, monitorTop - 0.45, 0),
        text: '50–75 cm',
      },
    };

    for (const [key, measurement] of Object.entries(measurements) as [MetricKey, typeof measurements[MetricKey]][]) {
      const visual = metricVisuals[key];
      setLine(visual.line, measurement.start, measurement.end);
      const horizontal = Math.abs(measurement.end.x - measurement.start.x) > Math.abs(measurement.end.y - measurement.start.y);
      if (horizontal) {
        setLine(visual.capStart, measurement.start.clone().add(new THREE.Vector3(0, -cap, 0)), measurement.start.clone().add(new THREE.Vector3(0, cap, 0)));
        setLine(visual.capEnd, measurement.end.clone().add(new THREE.Vector3(0, -cap, 0)), measurement.end.clone().add(new THREE.Vector3(0, cap, 0)));
      } else {
        setLine(visual.capStart, measurement.start.clone().add(new THREE.Vector3(-cap, 0, 0)), measurement.start.clone().add(new THREE.Vector3(cap, 0, 0)));
        setLine(visual.capEnd, measurement.end.clone().add(new THREE.Vector3(-cap, 0, 0)), measurement.end.clone().add(new THREE.Vector3(cap, 0, 0)));
      }
      visual.anchor.copy(measurement.start).lerp(measurement.end, 0.5);
      visual.label.textContent = measurement.text;
      visual.label.hidden = (state.posture === 'standing' && key === 'seat') || (state.posture === 'sitting' && key === 'distance');
      visual.line.visible = visual.capStart.visible = visual.capEnd.visible = !visual.label.hidden;
    }
  }

  function positionLabels() {
    const rect = stage.getBoundingClientRect();
    for (const visual of Object.values(metricVisuals)) {
      if (visual.label.hidden) continue;
      const projected = visual.anchor.clone().project(camera);
      visual.label.style.transform = `translate(-50%, -50%) translate(${(projected.x * 0.5 + 0.5) * rect.width}px, ${(-projected.y * 0.5 + 0.5) * rect.height}px)`;
      visual.label.style.zIndex = projected.z < 1 ? '2' : '-1';
    }
  }

  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.fov = width < 600 ? 38 : 34;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  resize();

  const timer = new THREE.Timer();
  timer.connect(document);
  function render() {
    requestAnimationFrame(render);
    if (!targetState) return;
    timer.update();
    const delta = Math.min(timer.getDelta(), 0.05);
    const smoothing = reduceMotion.matches ? 1 : 1 - Math.pow(0.0008, delta);
    const result = targetState.result;
    const postureTarget = targetState.posture === 'standing' ? 1 : 0;
    postureMix = lerp(postureMix, postureTarget, smoothing);
    const deskTarget = (targetState.posture === 'sitting' ? result.sittingDesk.reference : result.standingDesk.reference) * CM;
    const monitorTarget = (targetState.posture === 'sitting' ? result.sittingMonitorTop.reference : result.standingMonitorTop.reference) * CM;
    deskHeight = lerp(deskHeight, deskTarget, smoothing);
    seatHeight = lerp(seatHeight, result.seat.reference * CM, smoothing);
    monitorTop = lerp(monitorTop, monitorTarget, smoothing);
    updateFurniture();
    updateRobot(targetState.height);
    updateMeasurements(targetState);
    controls.update();
    positionLabels();
    renderer.render(scene, camera);
  }
  render();

  return { update };
}
