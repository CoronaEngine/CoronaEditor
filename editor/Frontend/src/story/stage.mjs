import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { createLevelCollision } from './collision.mjs';
import { createBossDirector } from './bossAnimation.mjs';
import { LEVEL, MERCHANT, PLAYER_MODEL } from './session.mjs';

function release(root) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  root.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of [].concat(node.material || [])) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const texture of textures) {
    texture.dispose();
    texture.source?.data?.close?.();
  }
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

function readAsset(url, signal) {
  // CEF serves installed builds over file://. Web fetch does not implement that scheme.
  if (url.protocol !== 'file:')
    return fetch(url, { signal }).then((response) => {
      if (!response.ok) throw new Error('模型加载失败 ' + response.status);
      return response.arrayBuffer();
    });
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    xhr.open('GET', url.href);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () =>
      xhr.response?.byteLength ? resolve(xhr.response) : reject(new Error('模型文件为空'));
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
  const ix = Math.max(
    0,
    Math.min(width - 1, Math.floor(((x / scale - left) / (right - left)) * width))
  );
  const iz = Math.max(
    0,
    Math.min(depth - 1, Math.floor(((z / scale - near) / (far - near)) * depth))
  );
  return (grid.minY + grid.heights[iz * width + ix] / 100) * scale;
}

export function createStage(host, game, onContextLost) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9caaa9);
  const world = new THREE.Group();
  world.scale.z = -1;
  scene.add(world);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 220);
  const sun = new THREE.DirectionalLight(0xfff2df, 2.0);
  sun.position.set(-7, 14, 6);
  scene.add(sun, new THREE.HemisphereLight(0xe3edf2, 0x77776b, 1.6));
  const abort = new AbortController(),
    assetRoot = new URL('./story/models/', document.baseURI);
  const manager = new THREE.LoadingManager(),
    blobs = new Map();
  manager.addHandler(/\.tga$/i, new TGALoader(manager));
  manager.setURLModifier((url) => blobs.get(url.split(/[\\/]/).pop()?.toLowerCase()) || url);
  const gltf = new GLTFLoader(manager);
  let disposed = false,
    terrain = null,
    collision = null,
    playerClip = 'IdleB';
  const mixers = [];
  const token = (x, z) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    world.add(group);
    return group;
  };
  const hero = token(0, 0),
    merchant = token(MERCHANT.x, MERCHANT.z);
  merchant.rotation.y = Math.PI;
  const enemies = game.enemies.map((e) => token(e.x, e.z));
  const floor = (x, z) => groundHeight(terrain, x, z);
  void readAsset(new URL('../story-map-height.json', assetRoot), abort.signal)
    .then((bytes) => {
      if (disposed) return;
      const data = JSON.parse(new TextDecoder().decode(bytes));
      if (
        data.version === 1 &&
        data.unit === 'cm' &&
        data.heights?.length === data.res[0] * data.res[1]
      )
        terrain = data;
    })
    .catch((error) => {
      if (!disposed) console.warn('地形高度未加载', error);
    });

  async function parse(asset) {
    const url = new URL(asset, assetRoot),
      base = new URL('.', url).href;
    const bytes = await readAsset(url, abort.signal);
    if (/\.fbx$/i.test(asset)) {
      // The FBX stores Windows authoring paths. TGA loading in file:// CEF needs a blob URL.
      const names = new Set(new TextDecoder('latin1').decode(bytes).match(/[\w-]+\.tga/gi) || []);
      for (const name of names) {
        if (blobs.has(name.toLowerCase())) continue;
        const texture = await readAsset(new URL(name, base), abort.signal);
        if (disposed) throw new Error('场景已关闭');
        blobs.set(name.toLowerCase(), URL.createObjectURL(new Blob([texture])));
      }
      const object = new FBXLoader(manager).parse(bytes, base);
      return { scene: object, animations: object.animations };
    }
    if (/\.dae$/i.test(asset)) {
      const model = new ColladaLoader(manager).parse(new TextDecoder().decode(bytes), base);
      return { scene: model.scene, animations: model.scene.animations };
    }
    return gltf.parseAsync(bytes, base);
  }
  const animators = new Map();
  function animate(parent, clip, blend = 0.2, restart = false) {
    const record = animators.get(parent);
    if (!record) return;
    const assetClip =
      record.clips.find((c) => c.name.toLowerCase() === clip.toLowerCase()) ??
      record.clips.find((c) => c.name.toLowerCase().endsWith('|' + clip.toLowerCase()));
    if (!assetClip || (!restart && record.current?.getClip() === assetClip)) return;
    const next = record.mixer.clipAction(assetClip);
    const once = /^(Attack|Hurt|Die|Dead|Damage)/i.test(clip);
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    next.reset().play();
    if (record.current && record.current !== next) record.current.crossFadeTo(next, blend, false);
    record.current = next;
  }
  async function load(asset, parent, size, { map = false, byHeight = false, rotation = 0 } = {}) {
    try {
      const model = await parse(asset);
      if (disposed) {
        release(model.scene);
        return;
      }
      const oriented = new THREE.Group();
      oriented.add(model.scene);
      oriented.rotation.x = rotation;
      const bounds = new THREE.Box3().setFromObject(oriented, true);
      if (bounds.isEmpty()) {
        release(oriented);
        return;
      }
      const extent = bounds.getSize(new THREE.Vector3()),
        center = bounds.getCenter(new THREE.Vector3());
      const scale = size / (byHeight ? extent.y : Math.max(extent.x, extent.y, extent.z));
      oriented.scale.setScalar(scale);
      oriented.position.set(
        -center.x * scale,
        (map ? 124.0913 - center.y : -bounds.min.y) * scale,
        -center.z * scale
      );
      parent.add(oriented);
      if (map) collision = createLevelCollision(oriented);
      if (model.animations?.length) {
        const mixer = new THREE.AnimationMixer(model.scene);
        mixers.push(mixer);
        animators.set(parent, { mixer, clips: model.animations, current: null });
        animate(parent, parent === hero ? playerClip : 'Idle', 0);
      }
    } catch (error) {
      if (!disposed) console.warn('剧情模型加载失败', asset, error);
    }
  }
  void load(LEVEL.asset, world, 90, { map: true });
  void (async () => {
    await load(PLAYER_MODEL, hero, 1.8, { byHeight: true });
    for (const [i, e] of game.enemies.entries()) {
      if (disposed) return;
      await load(e.asset, enemies[i], e.size, { rotation: e.id === 'boss' ? -Math.PI / 2 : 0 });
    }
    if (!disposed) await load('merchant/Maw J Laygo.dae', merchant, 1.8, { byHeight: true });
  })();
  const bossDirector = () =>
    createBossDirector({
      play: (clip, blend, restart) => animate(enemies[0], clip, blend, restart),
      now: () => game.elapsed * 1000,
    });
  let bossVisuals = bossDirector(),
    lastBossHp = game.enemies[0].hp;
  function resize() {
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  const lost = (event) => {
    event.preventDefault();
    onContextLost();
  };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  host.append(renderer.domElement);
  observer.observe(host);
  resize();
  return {
    floor,
    constrain: (point) => (collision ? collision(point) : point),
    playPlayer(clip, blend) {
      playerClip = clip;
      animate(hero, clip, blend);
    },
    draw(dt, pose) {
      if (disposed) return;
      const p = game.player;
      hero.position.set(p.x, p.y, p.z);
      hero.rotation.y = p.yaw - Math.PI / 2;
      hero.visible = pose.view !== 'first';
      merchant.position.y = floor(MERCHANT.x, MERCHANT.z);
      game.enemies.forEach((e, i) => {
        const group = enemies[i];
        const moving = Math.hypot(group.position.x - e.x, group.position.z - e.z) > 0.0001;
        group.visible = e.hp > 0 || e.id === 'boss';
        group.position.set(e.x, floor(e.x, e.z), e.z);
        if (moving) group.rotation.y = Math.atan2(p.x - e.x, p.z - e.z);
        const distance = Math.hypot(p.x - e.x, p.z - e.z);
        if (e.id === 'boss' && animators.has(group)) {
          if (e.hp > lastBossHp) {
            bossVisuals.dispose();
            bossVisuals = bossDirector();
          }
          bossVisuals.tick({ hp: e.hp, distance, wasHit: e.hp < lastBossHp });
          lastBossHp = e.hp;
        } else animate(group, distance < 2 ? 'Attack1' : moving ? 'Walk' : 'Idle');
      });
      for (const mixer of mixers) mixer.update(dt);
      const [x, y, z] = pose.position,
        [fx, fy, fz] = pose.forward;
      camera.position.set(x, y, -z);
      camera.lookAt(x + fx, y + fy, -z - fz);
      renderer.render(scene, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      bossVisuals.dispose();
      abort.abort();
      observer.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      for (const mixer of mixers) mixer.stopAllAction();
      for (const url of blobs.values()) URL.revokeObjectURL(url);
      release(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
