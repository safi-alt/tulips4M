import * as THREE from 'three';
import anime from 'animejs';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HandLandmarker, FilesetResolver } from
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

import { PARAMS, TULIP_VARIETIES, MIX_VARIETIES, varietyById } from './params.js';
import {
  makeSeededRandom, createShadedBladeGeometry, fillLeaf, makeVarietyMorphGeometry,
  morphWeightsFor, makeStemCurve, windOffset, bloomStageName,
} from './geometry.js';
import {
  makePetalMaps, createPetalMaterial, createLeafMaterial, createStemMaterial,
  createInteriorMaterials,
} from './materials.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const flowerCanvas = document.getElementById('flowerCanvas');
const hud = document.getElementById('hud');
const titleEl = document.getElementById('title');
const dedicationEl = document.getElementById('dedication');
const handsBtn = document.getElementById('handsBtn');
const stopCamBtn = document.getElementById('stopCamBtn');
const statusEl = document.getElementById('status');
const catalogTab = document.getElementById('catalogTab');
const varietyList = document.getElementById('varietyList');
const webcamVideo = document.getElementById('webcamVideo');
const overlayCanvas = document.getElementById('handOverlay');
const overlayContext = overlayCanvas.getContext('2d');

const renderer = new THREE.WebGLRenderer({ canvas: flowerCanvas, antialias: true });
let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x12080c);
scene.fog = new THREE.FogExp2(0x12080c, 0.012);

const camera = new THREE.PerspectiveCamera(
  PARAMS.camera.fov, window.innerWidth / window.innerHeight, 0.08, 80);
camera.position.set(...PARAMS.camera.introPosition);
camera.lookAt(new THREE.Vector3(...PARAMS.camera.introLookAt));

const orbitControls = new OrbitControls(camera, flowerCanvas);
orbitControls.target.set(...PARAMS.camera.introLookAt);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;
orbitControls.autoRotate = false;
orbitControls.minDistance = 4.2;
orbitControls.maxDistance = 9.5;
orbitControls.minPolarAngle = Math.PI * 0.18;
orbitControls.maxPolarAngle = Math.PI * 0.62;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  PARAMS.glow.strength, PARAMS.glow.radius, PARAMS.glow.threshold);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

window.addEventListener('resize', onResize);
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

scene.add(new THREE.AmbientLight(0xffe4d4, 0.18));
scene.add(new THREE.HemisphereLight(0x8a6570, 0x0c0808, 0.32));
const keyLight = new THREE.DirectionalLight(0xfff0e2, 1.35);
keyLight.position.set(3.4, 6.4, 4.8);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xc5d4ea, 0.22);
fillLight.position.set(-5.2, 2.8, -1.6);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0xffc0b8, 0.28);
rimLight.position.set(-2.4, 3.2, -5.5);
scene.add(rimLight);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
if ('environmentIntensity' in scene) scene.environmentIntensity = 0.4;
new RGBELoader().load(
  './assets/venice_sunset_1k.hdr',
  (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
    if ('environmentIntensity' in scene) scene.environmentIntensity = 0.46;
  },
  undefined,
  () => showStatus('Studio light is using a fallback.')
);

const garden = new THREE.Group();
scene.add(garden);

{
  const soil = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 48),
    new THREE.MeshStandardMaterial({ color: 0x1a0e12, roughness: 1, metalness: 0 })
  );
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = -0.02;
  garden.add(soil);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.012, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0xb86a7c, transparent: true, opacity: 0.22 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.004;
  garden.add(rim);
}

const fieldRandom = makeSeededRandom(PARAMS.field.seed);
const morphGeometryById = {};
const materialsById = {};
const petalMapsById = {};
for (const variety of MIX_VARIETIES) {
  morphGeometryById[variety.id] = makeVarietyMorphGeometry(variety);
  petalMapsById[variety.id] = makePetalMaps(variety);
  materialsById[variety.id] = createPetalMaterial(variety, petalMapsById[variety.id], keyLight);
}
const leafGeometry = createShadedBladeGeometry(
  PARAMS.leaves.lengthSegments, PARAMS.leaves.widthSegments);
fillLeaf(leafGeometry, PARAMS.leaves.archDeg);
const leafMaterial = createLeafMaterial();
const stemMaterial = createStemMaterial();
const interiors = createInteriorMaterials();
const stamenCurve = new THREE.QuadraticBezierCurve3(
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, PARAMS.stamens.length * 0.55, 0.01),
  new THREE.Vector3(0, PARAMS.stamens.length, 0.003)
);
const stamenGeometry = new THREE.TubeGeometry(stamenCurve, 8, PARAMS.stamens.radius, 5, false);
const antherGeometry = new THREE.SphereGeometry(PARAMS.stamens.antherSize, 6, 5);
const pistilGeometry = new THREE.CylinderGeometry(0.0048, 0.007, 0.15, 8);
const stigmaGeometry = new THREE.SphereGeometry(0.008, 8, 6);
const shadowGeometry = new THREE.CircleGeometry(0.28, 24);
const shadowMaterial = new THREE.MeshBasicMaterial({
  color: 0x050203, transparent: true, opacity: 0.28, depthWrite: false,
});

const tulips = [];
const scratchTan = new THREE.Vector3();
const scratchUp = new THREE.Vector3(0, 1, 0);

function addPetals(tulip, variety) {
  const count = variety.petalCount || 6;
  const geo = morphGeometryById[variety.id];
  const mat = materialsById[variety.id];
  for (let i = 0; i < count; i++) {
    const rings = count <= 6 ? 2 : 3;
    const ring = i % rings;
    const around = Math.floor(i / rings);
    const inRing = Math.ceil(count / rings);
    const pivot = new THREE.Group();
    pivot.rotation.order = 'YXZ';
    pivot.userData.ring = ring;
    pivot.userData.delay = ring * 0.07 + (fieldRandom() - 0.5) * 0.02;
    pivot.userData.tiltScale = ring === 0 ? 1 : (variety.innerTilt ?? 0.74);
    pivot.userData.sizeScale = (ring === 0 ? 1 : (variety.innerScale ?? 0.93))
      * (0.96 + fieldRandom() * 0.08);
    pivot.userData.lengthScale = 0.96 + fieldRandom() * 0.08;
    pivot.rotation.y = (around / inRing) * Math.PI * 2 + ring * 0.21
      + (fieldRandom() - 0.5) * 0.08;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = PARAMS.petals.baseOffset;
    mesh.scale.set(pivot.userData.sizeScale, pivot.userData.lengthScale, 1);
    mesh.morphTargetInfluences = [0, 0, 0];
    pivot.add(mesh);
    tulip.nodGroup.add(pivot);
    tulip.petalPivots.push(pivot);
    tulip.petalMeshes.push(mesh);
  }
}

function buildInterior(tulip) {
  const throat = new THREE.Group();
  tulip.nodGroup.add(throat);
  const pistil = new THREE.Mesh(pistilGeometry, interiors.pistil);
  pistil.position.y = 0.06;
  throat.add(pistil);
  for (let lobe = 0; lobe < 3; lobe++) {
    const stigma = new THREE.Mesh(stigmaGeometry, interiors.pistil);
    const a = (lobe / 3) * Math.PI * 2;
    stigma.position.set(Math.cos(a) * 0.007, 0.122, Math.sin(a) * 0.007);
    throat.add(stigma);
  }
  const stamenEntries = [];
  for (let i = 0; i < PARAMS.stamens.count; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / PARAMS.stamens.count) * Math.PI * 2;
    pivot.rotation.x = THREE.MathUtils.degToRad(9);
    const filament = new THREE.Mesh(stamenGeometry, interiors.stamen);
    const anther = new THREE.Mesh(antherGeometry, interiors.anther);
    anther.position.y = PARAMS.stamens.length;
    anther.scale.set(0.7, 1.55, 0.7);
    pivot.add(filament); pivot.add(anther);
    throat.add(pivot);
    stamenEntries.push({ pivot, filament, anther });
  }
  tulip.throat = throat;
  tulip.stamenEntries = stamenEntries;
}

{
  const plant = new THREE.Group();
  garden.add(plant);

  const height = PARAMS.field.height;
  const leanRad = THREE.MathUtils.degToRad(PARAMS.field.leanDeg);
  const leanYaw = 0;
  const lean = new THREE.Vector3(0, 0, Math.sin(leanRad) * height);
  const stemCurve = makeStemCurve(height, lean, 0);
  const stemGeo = new THREE.TubeGeometry(stemCurve, PARAMS.stem.segments * 2, PARAMS.stem.radius, 8, false);
  const stemMesh = new THREE.Mesh(stemGeo, stemMaterial);
  const windPivot = new THREE.Group();
  plant.add(windPivot);
  windPivot.add(stemMesh);

  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  plant.add(shadow);

  const flowerGroup = new THREE.Group();
  windPivot.add(flowerGroup);
  const nodGroup = new THREE.Group();
  nodGroup.rotation.order = 'XYZ';
  flowerGroup.add(nodGroup);

  const mixVariety = MIX_VARIETIES[Math.floor(fieldRandom() * MIX_VARIETIES.length)];
  const tulip = {
    plant, stemMesh, stemCurve, flowerGroup, nodGroup,
    petalPivots: [], petalMeshes: [], leafPivots: [],
    shadow, height, leanYaw,
    windPhase: fieldRandom() * Math.PI * 2,
    mixVarietyId: mixVariety.id,
    varietyId: mixVariety.id,
    restLeafX: [],
  };
  addPetals(tulip, mixVariety);
  buildInterior(tulip);

  for (let i = 0; i < PARAMS.leaves.count; i++) {
    const leafPivot = new THREE.Group();
    leafPivot.position.y = 0.12 + i * 0.08;
    leafPivot.rotation.order = 'YXZ';
    leafPivot.rotation.y = (i / PARAMS.leaves.count) * Math.PI * 2 + 0.4;
    const restX = THREE.MathUtils.degToRad(22 + i * 6);
    tulip.restLeafX.push(restX);
    leafPivot.rotation.x = restX;
    leafPivot.add(new THREE.Mesh(leafGeometry, leafMaterial));
    windPivot.add(leafPivot);
    tulip.leafPivots.push(leafPivot);
  }
  tulip.windPivot = windPivot;
  tulips.push(tulip);
}

let activeVarietyId = 'mixed';
function applyVariety(id) {
  activeVarietyId = id;
  for (const tulip of tulips) {
    const varietyId = id === 'mixed' ? tulip.mixVarietyId : id;
    const variety = varietyById[varietyId];
    if (tulip.varietyId !== varietyId || tulip.petalMeshes.length !== (variety.petalCount || 6)) {
      for (const pivot of tulip.petalPivots) tulip.nodGroup.remove(pivot);
      tulip.petalPivots.length = 0;
      tulip.petalMeshes.length = 0;
      tulip.varietyId = varietyId;
      addPetals(tulip, variety);
    } else {
      tulip.varietyId = varietyId;
      const mat = materialsById[varietyId];
      const geo = morphGeometryById[varietyId];
      for (const mesh of tulip.petalMeshes) {
        mesh.material = mat;
        mesh.geometry = geo;
      }
    }
  }
  for (const button of varietyList.querySelectorAll('.variety')) {
    button.setAttribute('aria-selected', button.dataset.id === id ? 'true' : 'false');
  }
}

for (const variety of TULIP_VARIETIES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'variety';
  button.dataset.id = variety.id;
  button.setAttribute('aria-selected', variety.id === 'mixed' ? 'true' : 'false');
  button.innerHTML =
    `<span class="variety-swatch" style="background:${variety.swatch}"></span>` +
    `<span><b>${variety.name}</b><i>${variety.latin}</i></span>`;
  button.addEventListener('click', () => applyVariety(variety.id));
  varietyList.appendChild(button);
}
catalogTab.addEventListener('click', () => {
  const open = document.body.classList.toggle('catalog-open');
  catalogTab.setAttribute('aria-expanded', open ? 'true' : 'false');
});

const demo = { grow: reducedMotion ? 1 : 0, bloom: reducedMotion ? 0.72 : 0 };
const demoTimeline = anime.timeline({
  autoplay: !reducedMotion, loop: true, easing: 'linear',
});
demoTimeline
  .add({ targets: demo, grow: 1, duration: 4800, easing: 'easeInOutCubic' }, 0)
  .add({ targets: demo, bloom: 1, duration: PARAMS.debug.openMs, easing: 'easeInOutCubic' }, 2400)
  .add({ targets: demo, bloom: 1, duration: PARAMS.debug.holdMs }, 2400 + PARAMS.debug.openMs)
  .add({ targets: demo, bloom: 0, duration: PARAMS.debug.closeMs, easing: 'easeInOutCubic' },
    2400 + PARAMS.debug.openMs + PARAMS.debug.holdMs)
  .add({ targets: demo, bloom: 0, duration: PARAMS.debug.restMs },
    2400 + PARAMS.debug.openMs + PARAMS.debug.holdMs + PARAMS.debug.closeMs);

let userDriving = false;
function pauseDemo() {
  userDriving = true;
  demoTimeline.pause();
}

const rawControl = { grow: 0, bloom: 0 };
const smoothControl = { grow: demo.grow, bloom: demo.bloom };
const lastStable = { grow: 0, bloom: 0 };
let debugEnabled = PARAMS.debug.enabled && !userDriving;
let pinnedBloom = null;
let hudVisible = false;

function applyGrow(growAmount) {
  for (const tulip of tulips) {
    const stemT = THREE.MathUtils.clamp(growAmount / 0.74, 0, 1);
    const eased = stemT * stemT * (3 - 2 * stemT);
    tulip.stemMesh.scale.set(1, Math.max(0.0008, eased), 1);
    tulip.shadow.scale.setScalar(0.35 + eased * 0.9);

    const tip = tulip.stemCurve.getPoint(eased);
    tulip.flowerGroup.position.copy(tip);
    scratchTan.copy(tulip.stemCurve.getTangent(Math.max(0.02, eased))).normalize();
    tulip.flowerGroup.quaternion.setFromUnitVectors(scratchUp, scratchTan);

    const leafT = THREE.MathUtils.clamp((growAmount - 0.16) / 0.55, 0, 1);
    const leafEase = leafT * leafT * (3 - 2 * leafT);
    tulip.leafPivots.forEach((leafPivot, i) => {
      leafPivot.visible = leafT > 0.02;
      leafPivot.scale.set(1, Math.max(0.0008, leafEase), 1);
      leafPivot.rotation.x = THREE.MathUtils.lerp(0.08, tulip.restLeafX[i], leafEase);
    });

    const flowerT = THREE.MathUtils.clamp((growAmount - 0.58) / 0.42, 0, 1);
    const flowerEase = flowerT * flowerT * (3 - 2 * flowerT);
    tulip.flowerGroup.scale.setScalar(Math.max(0.0001, flowerEase * PARAMS.flowers.scale));
    tulip.growT = eased;
  }
}

function applyBloom(globalBloom) {
  for (const tulip of tulips) {
    const variety = varietyById[tulip.varietyId] || MIX_VARIETIES[0];
    const nod = THREE.MathUtils.lerp(
      PARAMS.flowers.nodBudDeg, PARAMS.flowers.nodOpenDeg,
      THREE.MathUtils.smoothstep(globalBloom, 0.12, 0.88));
    tulip.nodGroup.rotation.x = THREE.MathUtils.degToRad(nod);

    for (let i = 0; i < tulip.petalMeshes.length; i++) {
      const pivot = tulip.petalPivots[i];
      const delay = pivot.userData.delay;
      const petalT = THREE.MathUtils.clamp((globalBloom - delay) / (1 - delay || 1), 0, 1);
      const weights = morphWeightsFor(petalT);
      const inf = tulip.petalMeshes[i].morphTargetInfluences;
      inf[0] = weights[0]; inf[1] = weights[1]; inf[2] = weights[2];
      const tilt = THREE.MathUtils.lerp(variety.tiltBud, variety.tiltFull, petalT);
      pivot.rotation.x = THREE.MathUtils.degToRad(tilt) * pivot.userData.tiltScale;
    }

    const stamenT = THREE.MathUtils.smoothstep(globalBloom, 0.34, 0.86);
    tulip.throat.visible = stamenT > 0.04;
    const stamenScale = Math.max(0.0001, stamenT);
    for (const entry of tulip.stamenEntries) {
      entry.filament.scale.setScalar(stamenScale);
      entry.anther.scale.set(0.7 * stamenScale, 1.55 * stamenScale, 0.7 * stamenScale);
      entry.filament.visible = stamenT > 0.05;
      entry.anther.visible = stamenT > 0.1;
    }
  }
}

function applyWind(time) {
  if (reducedMotion) {
    for (const tulip of tulips) {
      const along = tulip.growT || 0;
      tulip.windPivot.rotation.x = THREE.MathUtils.degToRad(20) * along;
    }
    return;
  }
  for (const tulip of tulips) {
    const along = tulip.growT || 0;
    const off = windOffset(along, time, tulip.windPhase, false);
    tulip.windPivot.rotation.z = off.x * 0.35;
    tulip.windPivot.rotation.x = THREE.MathUtils.degToRad(20) * along + off.z * 0.15;
    const nodLag = Math.sin(time * 0.42 + tulip.windPhase - 0.45) * 0.012 * along;
    tulip.nodGroup.rotation.z = nodLag;
    tulip.leafPivots.forEach((leaf, i) => {
      leaf.rotation.z = Math.sin(time * 0.5 + tulip.windPhase + i) * 0.028 * along;
    });
  }
}

let handLandmarker = null;
let trackerStatus = 'camera idle';
let webcamStarted = false;
let cameraStream = null;
let handsDetected = 0;
let leftHandSeen = false;
let rightHandSeen = false;
let lastVideoTime = -1;
let trackingLostFrames = 0;

function showStatus(message) {
  statusEl.textContent = message;
  statusEl.classList.add('show');
  window.setTimeout(() => statusEl.classList.remove('show'), 3200);
}

async function initWebcamAndHands() {
  if (webcamStarted) return;
  webcamStarted = true;
  trackerStatus = 'loading…';
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' } });
    webcamVideo.srcObject = cameraStream;
    await webcamVideo.play().catch(() => {});
  } catch (mediaError) {
    webcamStarted = false;
    debugEnabled = true;
    handsBtn.style.display = 'block';
    stopCamBtn.style.display = 'none';
    webcamVideo.style.display = 'none';
    overlayCanvas.style.display = 'none';
    trackerStatus = 'no camera';
    showStatus('Camera unavailable — hand tracking needs a camera.');
    return;
  }
  try {
    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    const trackerOptions = {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      numHands: 2,
      runningMode: 'VIDEO',
    };
    try {
      handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, trackerOptions);
    } catch (gpuError) {
      trackerOptions.baseOptions.delegate = 'CPU';
      handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, trackerOptions);
    }
    trackerStatus = 'ready (' + trackerOptions.baseOptions.delegate + ')';
  } catch (handError) {
    trackerStatus = 'tracker failed';
    showStatus('Hand tracking failed — try the camera again.');
  }
}

function stopCamera() {
  if (cameraStream) {
    for (const track of cameraStream.getTracks()) track.stop();
    cameraStream = null;
  }
  webcamVideo.srcObject = null;
  webcamStarted = false;
  handLandmarker = null;
  webcamVideo.style.display = 'none';
  overlayCanvas.style.display = 'none';
  stopCamBtn.style.display = 'none';
  handsBtn.style.display = 'block';
  debugEnabled = true;
  trackerStatus = 'camera idle';
}

function computePinchValue(landmarks) {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const wrist = landmarks[0];
  const middleKnuckle = landmarks[9];
  const pinchGap = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
  const handScale = Math.hypot(wrist.x - middleKnuckle.x, wrist.y - middleKnuckle.y);
  if (handScale < 1e-5) return 0;
  const pinchRatio = pinchGap / handScale;
  const { pinchRatioMin, pinchRatioMax } = PARAMS.interaction;
  return THREE.MathUtils.clamp(
    (pinchRatio - pinchRatioMin) / (pinchRatioMax - pinchRatioMin), 0, 1);
}

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17],
];

function drawHandOverlay(handsFound, handednessList) {
  if (webcamVideo.videoWidth === 0) return;
  const overlayWidth = 640;
  const overlayHeight = Math.round(overlayWidth * webcamVideo.videoHeight / webcamVideo.videoWidth);
  if (overlayCanvas.width !== overlayWidth || overlayCanvas.height !== overlayHeight) {
    overlayCanvas.width = overlayWidth;
    overlayCanvas.height = overlayHeight;
  }
  overlayContext.clearRect(0, 0, overlayWidth, overlayHeight);
  for (let handIndex = 0; handIndex < handsFound.length; handIndex++) {
    const landmarks = handsFound[handIndex];
    const reportedLabel = handednessList[handIndex]?.[0]?.categoryName || '';
    let isPhysicalLeft = reportedLabel === 'Right';
    if (PARAMS.interaction.swapHands) isPhysicalLeft = !isPhysicalLeft;
    const handColor = isPhysicalLeft ? '#43e97b' : '#ff4d6d';
    const toScreenX = (landmark) => (1 - landmark.x) * overlayWidth;
    const toScreenY = (landmark) => landmark.y * overlayHeight;
    overlayContext.globalAlpha = 0.75;
    overlayContext.strokeStyle = handColor;
    overlayContext.lineWidth = 2;
    overlayContext.beginPath();
    for (const [fromIdx, toIdx] of HAND_CONNECTIONS) {
      overlayContext.moveTo(toScreenX(landmarks[fromIdx]), toScreenY(landmarks[fromIdx]));
      overlayContext.lineTo(toScreenX(landmarks[toIdx]), toScreenY(landmarks[toIdx]));
    }
    overlayContext.stroke();
    const pinchValue = computePinchValue(landmarks);
    overlayContext.globalAlpha = 1;
    overlayContext.fillStyle = '#fff';
    overlayContext.font = 'bold 16px monospace';
    overlayContext.textAlign = 'center';
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    overlayContext.fillText(
      `${isPhysicalLeft ? 'grow' : 'bloom'} ${pinchValue.toFixed(2)}`,
      (toScreenX(thumbTip) + toScreenX(indexTip)) / 2,
      (toScreenY(thumbTip) + toScreenY(indexTip)) / 2 - 12);
  }
}

function readHands() {
  if (!handLandmarker || webcamVideo.readyState < 2) return;
  if (webcamVideo.currentTime === lastVideoTime) return;
  lastVideoTime = webcamVideo.currentTime;
  let result;
  try {
    result = handLandmarker.detectForVideo(webcamVideo, performance.now());
  } catch (detectError) {
    trackerStatus = 'detect error';
    return;
  }
  const handsFound = result.landmarks || [];
  const handednessList = result.handedness || result.handednesses || [];
  handsDetected = handsFound.length;
  drawHandOverlay(handsFound, handednessList);
  if (handsFound.length === 0) {
    trackingLostFrames += 1;
    leftHandSeen = false;
    rightHandSeen = false;
    return;
  }
  trackingLostFrames = 0;
  leftHandSeen = false;
  rightHandSeen = false;
  for (let handIndex = 0; handIndex < handsFound.length; handIndex++) {
    const pinchValue = computePinchValue(handsFound[handIndex]);
    const reportedLabel = handednessList[handIndex]?.[0]?.categoryName || '';
    let isPhysicalLeft = reportedLabel === 'Right';
    if (PARAMS.interaction.swapHands) isPhysicalLeft = !isPhysicalLeft;
    if (isPhysicalLeft) {
      rawControl.grow = pinchValue;
      lastStable.grow = pinchValue;
      leftHandSeen = true;
    } else {
      rawControl.bloom = pinchValue;
      lastStable.bloom = pinchValue;
      rightHandSeen = true;
    }
  }
}

function setLiveHands() {
  pauseDemo();
  debugEnabled = false;
  if (cameraTween) cameraTween.pause();
  cameraTweening = false;
  handsBtn.style.display = 'none';
  webcamVideo.style.display = 'block';
  overlayCanvas.style.display = 'block';
  stopCamBtn.style.display = 'block';
  initWebcamAndHands();
}

handsBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  setLiveHands();
});
stopCamBtn.addEventListener('click', stopCamera);

const gardenCam = {
  x: PARAMS.camera.position[0], y: PARAMS.camera.position[1], z: PARAMS.camera.position[2],
  tx: PARAMS.camera.lookAt[0], ty: PARAMS.camera.lookAt[1], tz: PARAMS.camera.lookAt[2],
};
let cameraTween = null;
let cameraTweening = false;
let userOrbiting = false;

function applyCamProxy() {
  camera.position.set(gardenCam.x, gardenCam.y, gardenCam.z);
  orbitControls.target.set(gardenCam.tx, gardenCam.ty, gardenCam.tz);
}

function tweenCamera(to, duration) {
  if (cameraTween) cameraTween.pause();
  gardenCam.x = camera.position.x; gardenCam.y = camera.position.y; gardenCam.z = camera.position.z;
  gardenCam.tx = orbitControls.target.x; gardenCam.ty = orbitControls.target.y; gardenCam.tz = orbitControls.target.z;
  cameraTweening = true;
  cameraTween = anime({
    targets: gardenCam,
    x: to.x, y: to.y, z: to.z, tx: to.tx, ty: to.ty, tz: to.tz,
    duration, easing: 'easeInOutCubic', autoplay: true, update: applyCamProxy,
    complete: () => { cameraTweening = false; },
  });
}

if (!reducedMotion) {
  tweenCamera({
    x: PARAMS.camera.position[0], y: PARAMS.camera.position[1], z: PARAMS.camera.position[2],
    tx: PARAMS.camera.lookAt[0], ty: PARAMS.camera.lookAt[1], tz: PARAMS.camera.lookAt[2],
  }, 4200);
} else {
  camera.position.set(...PARAMS.camera.position);
  orbitControls.target.set(...PARAMS.camera.lookAt);
}

orbitControls.addEventListener('start', () => {
  userOrbiting = true;
  if (cameraTween) cameraTween.pause();
  orbitControls.autoRotate = false;
});
orbitControls.addEventListener('end', () => { userOrbiting = false; });

window.addEventListener('keydown', (keyEvent) => {
  if (keyEvent.key === 'd' || keyEvent.key === 'D') {
    if (debugEnabled) setLiveHands();
    else { debugEnabled = true; handsBtn.style.display = 'block'; }
  }
  if (keyEvent.key === 'h' || keyEvent.key === 'H') {
    hudVisible = !hudVisible;
    hud.style.display = hudVisible ? 'block' : 'none';
  }
  if (keyEvent.key === '1') { pauseDemo(); pinnedBloom = 0; debugEnabled = true; }
  if (keyEvent.key === '2') { pauseDemo(); pinnedBloom = 0.33; debugEnabled = true; }
  if (keyEvent.key === '3') { pauseDemo(); pinnedBloom = 0.66; debugEnabled = true; }
  if (keyEvent.key === '4') { pauseDemo(); pinnedBloom = 1; debugEnabled = true; }
  if (keyEvent.key === '0') { pinnedBloom = null; }
  if (keyEvent.key === 'Escape' && document.body.classList.contains('catalog-open')) {
    document.body.classList.remove('catalog-open');
    catalogTab.setAttribute('aria-expanded', 'false');
  }
});

const clock = new THREE.Clock();
let lastHandRead = 0;
let slowFrames = 0;
let frameCount = 0;
let fps = 60;
let fpsLast = performance.now();
let rafId = 0;
let pageHidden = false;

document.addEventListener('visibilitychange', () => {
  pageHidden = document.hidden;
  if (!pageHidden && !rafId) animate();
});

function animate() {
  rafId = requestAnimationFrame(animate);
  if (pageHidden) { rafId = 0; return; }
  const deltaSeconds = Math.min(clock.getDelta(), 0.5);
  const elapsedSeconds = clock.getElapsedTime();
  frameCount += 1;
  if (frameCount % 30 === 0) {
    const now = performance.now();
    fps = 30000 / (now - fpsLast);
    fpsLast = now;
    if (fps < 28) {
      slowFrames += 1;
      if (slowFrames > 3 && pixelRatio > 1) {
        pixelRatio = 1;
        renderer.setPixelRatio(1);
        bloomPass.strength = 0.1;
      }
    } else slowFrames = 0;
  }

  if (!debugEnabled && elapsedSeconds - lastHandRead > 1 / 20) {
    readHands();
    lastHandRead = elapsedSeconds;
  }

  let targetGrow, targetBloom;
  if (debugEnabled && pinnedBloom === null && !userDriving) {
    targetGrow = demo.grow;
    targetBloom = demo.bloom;
  } else if (pinnedBloom !== null) {
    targetGrow = 1;
    targetBloom = pinnedBloom;
  } else {
    const growSrc = leftHandSeen || trackingLostFrames < 12 ? rawControl.grow : lastStable.grow;
    const bloomSrc = rightHandSeen || trackingLostFrames < 12 ? rawControl.bloom : lastStable.bloom;
    targetGrow = THREE.MathUtils.clamp(growSrc / PARAMS.interaction.growFullAt, 0, 1);
    targetBloom = bloomSrc;
  }

  const alpha = 1 - Math.exp(-deltaSeconds / PARAMS.interaction.smoothingSeconds);
  smoothControl.grow += (targetGrow - smoothControl.grow) * alpha;
  smoothControl.bloom += (targetBloom - smoothControl.bloom) * alpha;

  applyGrow(smoothControl.grow);
  applyBloom(smoothControl.bloom);
  applyWind(elapsedSeconds);

  for (const id of Object.keys(materialsById)) {
    const mat = materialsById[id];
    if (mat.userData.updateKey) mat.userData.updateKey(camera);
  }

  if (elapsedSeconds > 8) titleEl.style.opacity = '0.35';
  if (smoothControl.bloom > 0.72 && smoothControl.grow > 0.85) dedicationEl.classList.add('visible');
  else dedicationEl.classList.remove('visible');
  orbitControls.update();
  composer.render();

  if (hudVisible) {
    hud.textContent =
      `mode: ${debugEnabled && !userDriving ? 'AUTO' : 'LIVE'}   fps ${fps.toFixed(0)}\n` +
      `grow ${smoothControl.grow.toFixed(2)}   bloom ${smoothControl.bloom.toFixed(2)} (${bloomStageName(smoothControl.bloom)})\n` +
      `L${leftHandSeen ? '✓' : '·'} R${rightHandSeen ? '✓' : '·'}  ${trackerStatus}`;
  }
}

window.PARAMS = PARAMS;
window.scenery = { scene, camera, garden, tulips, orbitControls };
animate();
