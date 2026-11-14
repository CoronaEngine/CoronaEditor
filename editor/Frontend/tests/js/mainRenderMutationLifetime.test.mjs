import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { computed, ref } from 'vue';
import { babelParse, parse } from 'vue/compiler-sfc';
import * as visionModes from '../../src/utils/visionRenderModes.js';
import { initializeWorldRenderBackend } from '../../src/services/worldRenderPolicy.js';
import { deferred } from './windowSessionFixtures.mjs';

const source = parse(fs.readFileSync(new URL('../../src/views/layout/MainPage.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content;
const names = ['mainRenderModeOptions', 'mainRenderModeLabel', 'mainRenderBackend', 'mainVisionRenderMode',
  'currentMainSceneId', 'currentMainCameraId', 'currentMainCamera', 'pendingMainRenderSelection',
  'mainRenderOperations', 'mainCameraOperation', 'retireMainRenderOperations',
  'initializeCreativeRenderMode', 'creativeRenderDefaultsBusy', 'creativeRenderDefaultsError',
  'selectMainRenderMode', 'isVector3', 'sceneGridEnabledFromSnapshot', 'applySceneSnapshot'];
const options = [
  ['Accumulation', 'toggleMainVisionAccumulation', [], 'accumulation'],
  ['Denoise', 'toggleMainVisionDenoise', [], 'denoise'],
  ['Denoiser', 'selectMainVisionDenoiser', ['relax'], 'denoiser'],
  ['StablePlanes', 'toggleMainVisionStablePlanes', [], 'stable_planes'],
];
for (const [name, method] of options) names.push(`mainVision${name}`, `mainVision${name}Busy`,
  `mainVision${name}Error`, `pendingMain${name}Selection`, method);
const declarations = babelParse(source, { sourceType: 'module' }).program.body
  .filter(node => node.type === 'VariableDeclaration' && node.declarations.some(item => names.includes(item.id.name)))
  .map(node => source.slice(node.start, node.end)).join('\n');

function mount(write) {
  const errors = [], calls = [], reads = [];
  const deps = { ref, computed, initializeWorldRenderBackend, worldModeState: { status: 'ready', mode: 'creative' }, ...visionModes, DEFAULT_SCENE_NAME: 'scene.ini',
    editorApi: { scene: { setCameraRenderSettings: (...args) => { calls.push(args); return write(...args); } } },
    logError: (...args) => errors.push(args), syncSceneCameraBinding: async (...args) => reads.push(args),
    resetRealtimeCameraInput() {}, scheduleCameraViewportSync() {}, syncViewportUiMode() {}, scheduleCameraUpdate() {},
    isRealtimeCameraInputActive: () => false };
  const host = new Function('deps', `const {${Object.keys(deps).join(',')}}=deps;
    let live=true, lastCameraViewportSignature;
    const viewCurrent=()=>live, currentSceneId=ref('scene.ini'), environmentArchiveSession=ref('archive');
    const cameraBindingState=ref({sceneId:'scene.ini',cameraId:'camera',cameraHandle:12,archiveSession:'archive'});
    const cameraState=ref({position:[0,0,0],forward:[0,0,1],up:[0,1,0],fov:60});
    const sceneGridEnabled=ref(true), sceneLightSettings={direction:{}};
    ${declarations}
    mainRenderBackend.value='vision';mainVisionRenderMode.value='restir';
    currentMainCamera.value={camera_id:'camera',handle:12,archive_session:'archive'};
    return {${names.filter(name => !['mainRenderOperations', 'mainCameraOperation', 'retireMainRenderOperations'].includes(name)).join(',')},
      cameraBindingState,currentSceneId,environmentArchiveSession,dispose:()=>{live=false;}};
  `)(deps);
  return { ...host, errors, calls, reads };
}
function retire(host, kind) {
  if (kind === 'unmount') host.dispose();
  if (kind === 'archive') { host.environmentArchiveSession.value='new';host.cameraBindingState.value.archiveSession='new'; }
  if (kind === 'scene') host.cameraBindingState.value.sceneId='other.ini';
  if (kind === 'camera') host.cameraBindingState.value.cameraId='other-camera';
  if (kind === 'handle') host.cameraBindingState.value.cameraHandle=15;
}
function state(host) {
  return { backend:host.mainRenderBackend.value,mode:host.mainVisionRenderMode.value,
    options:options.map(([name])=>[host[`mainVision${name}`].value,host[`mainVision${name}Busy`].value,
      host[`mainVision${name}Error`].value]), camera:structuredClone({...host.currentMainCamera.value}),
    errors:host.errors.length,reads:host.reads.length };
}
for (const retirement of ['unmount','archive','scene','camera','handle']) {
  for (const failure of [false,true]) {
    for (const [name,method,args,key] of options) {
      test(`main ${name} ${failure?'failure':'reply'} is ignored after ${retirement}`,async()=>{
        const pending=deferred(),host=mount(()=>pending.promise);
        const editing=host[method](...args);
        retire(host,retirement);const before=state(host);let fieldReads=0;
        if(failure)pending.reject(Error('old option failed'));
        else pending.resolve(new Proxy({vision:{[key]:key==='denoiser'?'reblur':false}}, {
          get(target,key){if(key==='vision'||key==='pending')fieldReads++;return target[key];}}));
        assert.equal(await editing,false);
        assert.deepEqual(state(host),before);assert.equal(fieldReads,0);
      });
    }
    for(const mode of ['native','path_tracing']) {
      test(`main ${mode} mode ${failure?'failure':'reply'} is ignored after ${retirement}`,async()=>{
        const pending=deferred(),host=mount(()=>pending.promise);
        const editing=host.selectMainRenderMode(mode);
        retire(host,retirement);const before=state(host);
        if(failure)pending.reject(Error('old mode failed'));
        else pending.resolve({render_backend:'native',vision:{render_mode:'ssat'}});
        assert.equal(await editing,false);assert.deepEqual(state(host),before);
      });
    }
  }
}
for(const failure of [false,true])test(`main superseded render mode ${failure?'failure':'reply'} cannot replace a newer choice`,async()=>{
  const pending=deferred();let writes=0;
  const host=mount(async(_scene,_camera,patch)=>++writes===1?pending.promise:
    {render_backend:patch.render_backend,vision:patch.vision});
  const first=host.selectMainRenderMode('path_tracing');
  await host.selectMainRenderMode('native');await host.selectMainRenderMode('restir');
  const before=state(host);
  if(failure)pending.reject(Error('first mode failed'));else pending.resolve({render_backend:'native'});
  assert.equal(await first,false);assert.deepEqual(state(host),before);
});
for(const [name,method,args,key] of options)test(`main ${name} binding replacement releases busy without old finally clearing the next request`,async()=>{
  const first=deferred(),next=deferred();let writes=0;
  const host=mount(()=>++writes===1?first.promise:next.promise);
  const old=host[method](...args);
  host.environmentArchiveSession.value='new';
  host.applySceneSnapshot('scene.ini',{archive_session:'new',cameras:[{camera_id:'camera',handle:12,
    render_backend:'vision',vision_render_mode:'restir'}]});
  assert.equal(host[`mainVision${name}Busy`].value,false);
  const current=host[method](...args);assert.equal(writes,2);
  first.resolve({vision:{[key]:false}});assert.equal(await old,false);
  assert.equal(host[`mainVision${name}Busy`].value,true);
  next.resolve({vision:{[key]:key==='denoiser'?'relax':true}});assert.equal(await current,true);
  assert.equal(host[`mainVision${name}Busy`].value,false);
});

for(const retirement of ['unmount','archive','new selection'])test(`main initialization finally is retired after ${retirement}`,async()=>{
  const pending=deferred();let writes=0;
  const host=mount(async(_scene,_camera,patch)=>++writes===1?pending.promise:
    {render_backend:patch.render_backend,vision:patch.vision});
  const starting=host.initializeCreativeRenderMode();
  if(retirement==='new selection')await host.selectMainRenderMode('native');else retire(host,retirement);
  const before=state(host),busy=host.creativeRenderDefaultsBusy.value;
  pending.resolve({render_backend:'vision'});
  assert.equal(await starting,false);assert.deepEqual(state(host),before);
  assert.equal(host.creativeRenderDefaultsBusy.value,busy);
});
