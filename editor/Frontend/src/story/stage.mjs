import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LEVEL, MERCHANT, PLAYER_MODEL } from './session.mjs';

function release(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of [].concat(node.material || [])) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const texture of textures) { texture.dispose(); texture.source?.data?.close?.(); }
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

function readAsset(url, signal) {
  // CEF serves installed builds over file://. Web fetch does not implement that scheme.
  if (url.protocol !== 'file:') return fetch(url, { signal }).then(response => {
    if (!response.ok) throw new Error('模型加载失败 ' + response.status);
    return response.arrayBuffer();
  });
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    xhr.open('GET', url.href);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => xhr.response?.byteLength ? resolve(xhr.response) : reject(new Error('模型文件为空'));
    xhr.onerror = xhr.onabort = () => reject(new Error('无法读取模型文件'));
    xhr.onloadend = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    xhr.send();
  });
}

// The shipped grid stores centimetres above minY in the mesh's original coordinate frame.
function groundHeight(grid, x, z) {
  if (!grid) return 0;
  const [width, depth] = grid.res;
  const [left, right, near, far] = grid.bounds;
  const scale = 90 / Math.max(right - left, far - near);
  const ix = Math.max(0, Math.min(width - 1, Math.floor((x / scale - left) / (right - left) * width)));
  const iz = Math.max(0, Math.min(depth - 1, Math.floor((z / scale - near) / (far - near) * depth)));
  return (grid.minY + grid.heights[iz * width + ix] / 100) * scale;
}

export function createStage(host, game, onContextLost) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x172e36);
  scene.fog = new THREE.FogExp2(0x233d43, 0.013);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  const sun = new THREE.DirectionalLight(0xffe2bc, 2.3);
  sun.position.set(-5, 12, -7);
  scene.add(sun, new THREE.HemisphereLight(0xfff1db, 0x477279, 2));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(74, 98), new THREE.MeshStandardMaterial({ color: 0x344a41 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  scene.add(ground);
  const grid = new THREE.GridHelper(74, 37, 0x4c7468, 0x3c5950);
  grid.position.y = -0.07;
  scene.add(grid);
  const abort = new AbortController();
  const loader = new GLTFLoader();
  const mixers = [];
  let disposed = false;
  const assetRoot = new URL('./story/models/', document.baseURI);
  let terrain = null;
  void readAsset(new URL('../story-map-height.json', assetRoot), abort.signal)
    .then(bytes => {
      if (disposed) return;
      const data = JSON.parse(new TextDecoder().decode(bytes));
      if (data.version === 1 && data.unit === 'cm' && data.res?.length === 2 &&
          data.bounds?.length === 4 && data.heights?.length === data.res[0] * data.res[1]) terrain = data;
    }).catch(error => { if (!disposed) console.warn('地形高度未加载', error); });
  function marker(size, color) {
    const node = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(size * 0.22, size * 0.5, 3, 8),
      new THREE.MeshStandardMaterial({ color }));
    mesh.position.y = size / 2;
    node.add(mesh);
    scene.add(node);
    return node;
  }
  const hero = marker(1.8, 0x66e9d0);
  const tokens = game.enemies.map(e => marker(e.size, e.id === 'boss' ? 0xe36c50 : 0xcaa462));
  const merchant = marker(1.7, 0x7dc1ff);
  merchant.position.set(MERCHANT.x, 0, MERCHANT.z);

  async function model(asset, parent, size, map = false, rotation = 0) {
    const url = new URL(asset, assetRoot);
    const bytes = await readAsset(url, abort.signal);
    if (disposed) return;
    const gltf = await loader.parseAsync(bytes, new URL('.', url).href);
    const object = gltf.scene;
    if (disposed) { release(object); return; }
    object.rotation.x = rotation;
    object.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(object);
    const extent = bounds.getSize(new THREE.Vector3());
    if (bounds.isEmpty() || extent.y <= 0) { release(object); return; }
    const scale = size / (map ? Math.max(extent.x, extent.z) : extent.y);
    const center = bounds.getCenter(new THREE.Vector3());
    object.scale.multiplyScalar(scale);
    object.position.set(-center.x * scale, map ? 0 : -bounds.min.y * scale, -center.z * scale);
    if (map) grid.visible = false;
    else {
      const placeholder = parent.children[0];
      parent.remove(placeholder);
      release(placeholder);
    }
    parent.add(object);
    if (!map && gltf.animations.length) {
      const mixer = new THREE.AnimationMixer(object);
      mixer.clipAction(gltf.animations.find(clip => /idle/i.test(clip.name)) ?? gltf.animations[0]).play();
      mixers.push(mixer);
    }
  }
  function load(asset, parent, size, map, rotation) {
    return model(asset, parent, size, map, rotation).catch(error => {
      if (!disposed) console.warn('剧情资源未加载，保留场景标记', asset, error);
    });
  }
  // Bound simultaneous decoding of the shipped meshes. Markers remain playable during loading.
  void load(LEVEL.asset, scene, 90, true);
  void (async () => {
    await load(PLAYER_MODEL, hero, 1.8);
    for (const [i, enemy] of game.enemies.entries()) {
      if (disposed) break;
      await load(enemy.asset, tokens[i], enemy.size, false, enemy.id === 'boss' ? -Math.PI / 2 : 0);
    }
  })();
  function resize() {
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  const lost = event => { event.preventDefault(); onContextLost(); };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  host.append(renderer.domElement);
  observer.observe(host);
  resize();
  return {
    draw(dt, overhead) {
      if (disposed) return;
      const player = game.player;
      const y = groundHeight(terrain, player.x, player.z);
      hero.position.set(player.x, y, player.z);
      merchant.position.y = groundHeight(terrain, MERCHANT.x, MERCHANT.z);
      hero.rotation.y = player.yaw - Math.PI / 2;
      game.enemies.forEach((e, i) => {
        tokens[i].visible = e.hp > 0;
        tokens[i].position.set(e.x, groundHeight(terrain, e.x, e.z), e.z);
        tokens[i].rotation.y = Math.atan2(player.x - e.x, player.z - e.z);
      });
      for (const mixer of mixers) mixer.update(dt);
      camera.position.set(player.x, y + (overhead ? 23 : 7), player.z - (overhead ? 0.1 : 10));
      camera.lookAt(player.x, y + 1, player.z + 1);
      renderer.render(scene, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      observer.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      for (const mixer of mixers) mixer.stopAllAction();
      release(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
