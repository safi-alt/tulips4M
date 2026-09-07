import * as THREE from 'three';
import { PARAMS } from './params.js';

export function makeSeededRandom(seed) {
  let state = seed >>> 0;
  return function seededRandom() {
    state |= 0; state = state + 0x6D2B79F5 | 0;
    let temp = Math.imul(state ^ state >>> 15, 1 | state);
    temp = temp + Math.imul(temp ^ temp >>> 7, 61 | temp) ^ temp;
    return ((temp ^ temp >>> 14) >>> 0) / 4294967296;
  };
}

export function hashNoise(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function tulipWidthProfile(lengthT, variety) {
  const t = THREE.MathUtils.clamp(lengthT, 0, 1);
  const waist = variety.waist ?? 0.14;
  const peakAt = variety.peakAt ?? 0.4;
  const tipNarrow = variety.tipNarrow ?? 0.38;
  const tipPow = variety.tipPow ?? 1.7;
  let width;
  if (t < peakAt) {
    const u = t / peakAt;
    const rise = u * u * (3 - 2 * u);
    width = waist + (1 - waist) * rise;
  } else {
    const u = (t - peakAt) / (1 - peakAt);
    width = 1 - tipNarrow * Math.pow(u, tipPow);
  }
  if (variety.shape === 'pointed') {
    width *= 1 - Math.pow(Math.max(0, (t - 0.62) / 0.38), 1.15) * 0.22;
  }
  return Math.max(0.06, width);
}

export function createShadedBladeGeometry(lengthSegments, widthSegments) {
  const geometry = new THREE.BufferGeometry();
  const vertexCount = (lengthSegments + 1) * (widthSegments + 1);
  geometry.setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));
  const uvs = new Float32Array(vertexCount * 2);
  let uvIndex = 0;
  for (let row = 0; row <= lengthSegments; row++) {
    const lengthT = row / lengthSegments;
    for (let col = 0; col <= widthSegments; col++) {
      uvs[uvIndex++] = col / widthSegments;
      uvs[uvIndex++] = lengthT;
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  const indices = [];
  for (let row = 0; row < lengthSegments; row++) {
    for (let col = 0; col < widthSegments; col++) {
      const a = row * (widthSegments + 1) + col;
      const b = (row + 1) * (widthSegments + 1) + col;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geometry.setIndex(indices);
  return geometry;
}

export function fillTulipPetal(geometry, variety, pose) {
  const conf = PARAMS.petals;
  const positions = geometry.attributes.position.array;
  const recurveRad = THREE.MathUtils.degToRad(pose.recurve);
  const wrapRad = THREE.MathUtils.degToRad(pose.wrap);
  const length = conf.length * (variety.lengthMul ?? 1);
  const maxWidth = conf.maxWidth * (variety.widthMul ?? 1);
  const stepLen = length / conf.lengthSegments;
  const cupDepth = (variety.cupDepth ?? 1) * (pose.cup ?? 1);
  const ruffle = variety.ruffle ?? 0;
  const curlExponent = conf.curlExponent;
  const tipCurl = THREE.MathUtils.degToRad(pose.tipCurl ?? 8);

  let writeIndex = 0;
  let spineY = 0;
  let spineZ = 0;

  for (let row = 0; row <= conf.lengthSegments; row++) {
    const lengthT = row / conf.lengthSegments;
    const profile = tulipWidthProfile(lengthT, variety);
    const halfWidth = maxWidth * profile * 0.5;
    const spineAngle = recurveRad * Math.pow(lengthT, curlExponent)
      + tipCurl * Math.pow(lengthT, 3.4);
    const rowWrap = wrapRad * (0.55 + 0.45 * (1 - lengthT * 0.65));
    const spoonR = Math.max(0.045, (0.055 + 0.14 * lengthT) * cupDepth);

    for (let col = 0; col <= conf.widthSegments; col++) {
      const u = col / conf.widthSegments * 2 - 1;
      const edgeness = Math.abs(u);
      const halfAngle = Math.atan2(halfWidth, spoonR);
      const theta = u * halfAngle;
      const irr = ruffle * 0.01 * edgeness * lengthT
        * Math.sin(lengthT * 10.5 + u * 4.2 + (variety.id?.length || 1));
      const x = Math.sin(theta) * (spoonR + irr);
      const zSpoon = (1 - Math.cos(theta)) * spoonR * 0.92;
      const wrapX = Math.sin(u * rowWrap * 0.28) * halfWidth * 0.15 * (1 - lengthT);
      positions[writeIndex++] = x + wrapX;
      positions[writeIndex++] = spineY;
      positions[writeIndex++] = spineZ + zSpoon;
    }
    spineY += Math.cos(spineAngle) * stepLen;
    spineZ += Math.sin(spineAngle) * stepLen;
  }
  geometry.attributes.position.needsUpdate = true;
}

export function poseFor(variety, key) {
  const wrapBud = variety.wrapBud ?? 74;
  const wrapFull = variety.wrapFull ?? 24;
  const recBud = variety.recurveBud ?? -16;
  const recFull = variety.recurveFull ?? 14;
  const mix = { bud: 0, loosen: 0.3, cup: 0.68, full: 1 }[key];
  return {
    wrap: THREE.MathUtils.lerp(wrapBud, wrapFull, mix),
    recurve: THREE.MathUtils.lerp(recBud, recFull, mix),
    cup: THREE.MathUtils.lerp(1.18, 1, mix),
    tipCurl: THREE.MathUtils.lerp(4, 11, mix),
  };
}

function copyAttr(srcArray) {
  return new THREE.Float32BufferAttribute(new Float32Array(srcArray), 3);
}

export function makeVarietyMorphGeometry(variety) {
  const { lengthSegments, widthSegments } = PARAMS.petals;
  const geometry = createShadedBladeGeometry(lengthSegments, widthSegments);
  const scratch = createShadedBladeGeometry(lengthSegments, widthSegments);
  const keys = ['bud', 'loosen', 'cup', 'full'];
  const poses = keys.map((key) => {
    fillTulipPetal(scratch, variety, poseFor(variety, key));
    scratch.computeVertexNormals();
    return {
      position: new Float32Array(scratch.attributes.position.array),
      normal: new Float32Array(scratch.attributes.normal.array),
    };
  });
  scratch.dispose();

  geometry.setAttribute('position', copyAttr(poses[0].position));
  geometry.setAttribute('normal', copyAttr(poses[0].normal));
  geometry.morphAttributes.position = [
    copyAttr(poses[1].position),
    copyAttr(poses[2].position),
    copyAttr(poses[3].position),
  ];
  geometry.morphAttributes.normal = [
    copyAttr(poses[1].normal),
    copyAttr(poses[2].normal),
    copyAttr(poses[3].normal),
  ];
  geometry.morphTargetsRelative = false;
  geometry.morphAttributes.position.forEach((attr) => { attr.name = 'position'; });
  geometry.morphAttributes.normal.forEach((attr) => { attr.name = 'normal'; });
  return geometry;
}

export function morphWeightsFor(progress) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  const w = [0, 0, 0];
  if (t <= 1 / 3) {
    w[0] = t * 3;
  } else if (t <= 2 / 3) {
    const u = (t - 1 / 3) * 3;
    w[0] = 1 - u;
    w[1] = u;
  } else {
    const u = (t - 2 / 3) * 3;
    w[1] = 1 - u;
    w[2] = u;
  }
  return w;
}

export function fillLeaf(geometry, archDeg) {
  const conf = PARAMS.leaves;
  const positions = geometry.attributes.position.array;
  const archRad = THREE.MathUtils.degToRad(archDeg);
  const stepLen = conf.length / conf.lengthSegments;
  let writeIndex = 0;
  let spineY = 0;
  let spineZ = 0;
  for (let row = 0; row <= conf.lengthSegments; row++) {
    const lengthT = row / conf.lengthSegments;
    const widthProfile = Math.sin(Math.PI * Math.min(1, Math.pow(lengthT, 0.72) * 1.05)) ** 0.65;
    const halfWidth = conf.maxWidth * widthProfile * 0.5;
    for (let col = 0; col <= conf.widthSegments; col++) {
      const widthT = col / conf.widthSegments - 0.5;
      const fold = Math.pow(Math.abs(widthT) * 2, 1.4) * 0.016;
      positions[writeIndex++] = widthT * 2 * halfWidth;
      positions[writeIndex++] = spineY;
      positions[writeIndex++] = spineZ - fold;
    }
    const spineAngle = archRad * Math.pow(lengthT, 1.05);
    spineY += Math.cos(spineAngle) * stepLen;
    spineZ += Math.sin(spineAngle) * stepLen;
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals();
}

export function makeStemCurve(height, lean, phase) {
  const points = [];
  const segs = PARAMS.stem.segments;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const sway = Math.sin(t * Math.PI) * PARAMS.stem.curveJitter;
    points.push(new THREE.Vector3(
      Math.sin(phase) * sway * height * 0.1 + lean.x * t * t,
      t * height,
      Math.cos(phase) * sway * height * 0.1 + lean.z * t * t
    ));
  }
  return new THREE.CatmullRomCurve3(points);
}

export function windOffset(along, time, phase, reduced) {
  const amp = along * along;
  const calm = reduced ? 0.25 : 1;
  const a = Math.sin(time * 0.42 + phase) * 0.034
    + Math.sin(time * 0.17 + phase * 1.6) * 0.016;
  const b = Math.cos(time * 0.31 + phase * 0.8) * 0.02;
  return new THREE.Vector3(a * amp * calm, 0, b * amp * calm);
}

export function heartXZ(t, scale) {
  const s = Math.sin(t);
  const c = Math.cos(t);
  const x = 16 * s * s * s;
  const y = 13 * c - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return new THREE.Vector3(x * scale, 0, -y * scale);
}

export function makeHeartShape(scale) {
  const shape = new THREE.Shape();
  const steps = 96;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const p = heartXZ(t, scale);
    if (i === 0) shape.moveTo(p.x, -p.z);
    else shape.lineTo(p.x, -p.z);
  }
  return shape;
}

export function pointInPolygon(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z;
    const xj = polygon[j].x, zj = polygon[j].z;
    const intersect = ((zi > z) !== (zj > z)) &&
      (x < (xj - xi) * (z - zi) / ((zj - zi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function staggeredFromCenter(amount, radiusT, spread) {
  const delay = radiusT * spread;
  return THREE.MathUtils.clamp((amount - delay) / Math.max(1e-4, 1 - delay), 0, 1);
}

export function bloomStageName(t) {
  if (t < 0.08) return 'tight bud';
  if (t < 0.34) return 'loosening';
  if (t < 0.68) return 'opening cup';
  if (t < 0.92) return 'full tulip';
  return 'settled bloom';
}
