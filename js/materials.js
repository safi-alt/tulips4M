import * as THREE from 'three';
import { PARAMS } from './params.js';
import { hashNoise } from './geometry.js';

function veinField(u, v) {
  const mid = 0.5 + (hashNoise(v * 5.1, 2.2) - 0.5) * 0.03;
  let field = Math.exp(-Math.pow((u - mid) / (0.05 + v * 0.018), 2)) * 0.85;
  for (let k = 0; k < 4; k++) {
    const side = k < 2 ? -1 : 1;
    const rung = k % 2;
    const start = 0.14 + rung * 0.1;
    if (v <= start) continue;
    const along = (v - start) / (1 - start);
    const center = mid + side * (0.11 + rung * 0.1)
      + (hashNoise(k * 3.7, v * 2.1) - 0.5) * 0.025;
    const wobble = Math.sin(v * 8.4 + k * 1.7) * 0.01;
    const width = 0.016 + along * 0.006;
    field += Math.exp(-Math.pow((u - center - wobble) / width, 2))
      * (0.18 + 0.28 * along) * (1 - start);
  }
  return field;
}

export function makePetalMaps(variety) {
  const width = 256;
  const height = 512;
  const albedo = document.createElement('canvas');
  albedo.width = width; albedo.height = height;
  const bump = document.createElement('canvas');
  bump.width = width; bump.height = height;
  const rough = document.createElement('canvas');
  rough.width = width; rough.height = height;
  const a = albedo.getContext('2d');
  const b = bump.getContext('2d');
  const r = rough.getContext('2d');
  const image = a.createImageData(width, height);
  const bumpImage = b.createImageData(width, height);
  const roughImage = r.createImageData(width, height);
  const [pr, pg, pb] = variety.petal;
  const [tr, tg, tb] = variety.throat;
  const [er, eg, eb] = variety.edge;

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const across = Math.abs(u - 0.5) * 2;
      const throat = Math.pow(Math.max(0, 1 - v / 0.3), 1.7);
      const tip = Math.pow(v, 1.4);
      const rib = Math.exp(-Math.pow((u - 0.5) / 0.08, 2));
      const vein = veinField(u, v);
      const grain = (hashNoise(x * 0.11, y * 0.19) - 0.5) * 0.045;
      const flame = variety.flame
        ? Math.pow(across, 2.6) * Math.pow(v, 0.55) * 0.85
        : 0;
      const mixThroat = throat * 0.72;
      const mixEdge = Math.min(0.85, Math.max(across * 0.32, tip * 0.22, flame));
      const remain = Math.max(0, 1 - mixThroat - mixEdge);
      let cr = pr * remain + tr * mixThroat + er * mixEdge;
      let cg = pg * remain + tg * mixThroat + eg * mixEdge;
      let cb = pb * remain + tb * mixThroat + eb * mixEdge;
      cr = cr * (1 + grain - vein * 0.07 + rib * 0.03);
      cg = cg * (1 + grain - vein * 0.055 + rib * 0.025);
      cb = cb * (1 + grain - vein * 0.04 + rib * 0.02);
      const i = (y * width + x) * 4;
      image.data[i] = Math.max(0, Math.min(255, cr));
      image.data[i + 1] = Math.max(0, Math.min(255, cg));
      image.data[i + 2] = Math.max(0, Math.min(255, cb));
      image.data[i + 3] = 255;
      const heightV = 132 + rib * 18 + vein * 16 - across * 6 + grain * 20;
      bumpImage.data[i] = bumpImage.data[i + 1] = bumpImage.data[i + 2] =
        Math.max(0, Math.min(255, heightV));
      bumpImage.data[i + 3] = 255;
      const roughV = 118 + across * 28 + tip * 18 - throat * 12 + grain * 16;
      roughImage.data[i] = roughImage.data[i + 1] = roughImage.data[i + 2] =
        Math.max(40, Math.min(210, roughV));
      roughImage.data[i + 3] = 255;
    }
  }
  a.putImageData(image, 0, 0);
  b.putImageData(bumpImage, 0, 0);
  r.putImageData(roughImage, 0, 0);

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.anisotropy = 4;
  const roughnessMap = new THREE.CanvasTexture(rough);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.anisotropy = 4;
  return { map, bumpMap, roughnessMap };
}

export function makeLeafMaps() {
  const width = 128;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const across = Math.abs(u - 0.5) * 2;
      const rib = Math.exp(-Math.pow((u - 0.5) / 0.055, 2));
      const grain = (hashNoise(x * 0.2, y * 0.13) - 0.5) * 8;
      const i = (y * width + x) * 4;
      image.data[i] = 36 + rib * 16 + (1 - v) * 6 + grain;
      image.data[i + 1] = 92 + rib * 28 - across * 14 + grain;
      image.data[i + 2] = 40 + rib * 8 + grain * 0.4;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

export function attachPetalBacklight(material, keyLight) {
  material.userData.keyDir = new THREE.Vector3();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uKeyDir = { value: material.userData.keyDir };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uKeyDir;`
      )
      .replace(
        '#include <opaque_fragment>',
        `float backlit = pow(max(0.0, -dot(normalize(normal), normalize(uKeyDir))), 1.45);
float edge = abs(vMapUv.x - 0.5) * 2.0;
float thin = mix(0.22, 0.72, edge) * mix(0.55, 1.0, vMapUv.y);
outgoingLight += diffuseColor.rgb * backlit * thin * 0.16;
#include <opaque_fragment>`
      );
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => 'petal-backlight-v1';
  material.userData.updateKey = (camera) => {
    material.userData.keyDir.copy(keyLight.position).normalize()
      .transformDirection(camera.matrixWorldInverse);
    const shader = material.userData.shader;
    if (shader) shader.uniforms.uKeyDir.value.copy(material.userData.keyDir);
  };
}

export function createPetalMaterial(variety, maps, keyLight) {
  const sheen = variety.sheen || [180, 80, 80];
  const material = new THREE.MeshPhysicalMaterial({
    map: maps.map,
    bumpMap: maps.bumpMap,
    bumpScale: 0.0055,
    roughnessMap: maps.roughnessMap,
    roughness: 1,
    metalness: 0,
    sheen: variety.id === 'queen' ? 0.18 : 0.32,
    sheenRoughness: 0.62,
    sheenColor: new THREE.Color(sheen[0] / 255, sheen[1] / 255, sheen[2] / 255),
    clearcoat: 0.04,
    clearcoatRoughness: 0.7,
    envMapIntensity: 0.42,
    side: THREE.DoubleSide,
    morphTargets: true,
    morphNormals: true,
  });
  attachPetalBacklight(material, keyLight);
  return material;
}

export function createLeafMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: PARAMS.leaves.color,
    map: makeLeafMaps(),
    roughness: 0.7,
    metalness: 0,
    sheen: 0.12,
    sheenColor: new THREE.Color(0x6a9a58),
    clearcoat: 0.08,
    clearcoatRoughness: 0.55,
    side: THREE.DoubleSide,
  });
}

export function createStemMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: PARAMS.stem.color,
    roughness: 0.68,
    metalness: 0,
    sheen: 0.08,
    sheenColor: new THREE.Color(0x5a8a48),
  });
}

export function createInteriorMaterials() {
  return {
    stamen: new THREE.MeshStandardMaterial({
      color: PARAMS.stamens.color,
      roughness: 0.45,
      metalness: 0,
    }),
    anther: new THREE.MeshStandardMaterial({
      color: PARAMS.stamens.antherColor,
      roughness: 0.55,
      metalness: 0,
    }),
    pistil: new THREE.MeshStandardMaterial({
      color: PARAMS.stamens.pistilColor,
      roughness: 0.5,
      metalness: 0,
    }),
  };
}
