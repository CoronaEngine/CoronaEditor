import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers';
import { babelParse, parse } from 'vue/compiler-sfc';
import { editorApi } from '../../src/api/editorApi.js';

const script = parse(readFileSync(new URL('../../src/views/sidebar/SceneBar.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content;
const names = ['unwrapBridgePayload', 'selectedPathFromImportPayload', 'createActorFromSelectedFile',
  'importSequence', 'importSceneResource', 'HandleFileImport', 'HandleUiImageImport', 'HandleActorImport', 'HandleMultimediaImport'];
const declarations = babelParse(script, { sourceType: 'module' }).program.body.filter(node =>
  node.type === 'VariableDeclaration' && node.declarations.some(d => names.includes(d.id.name)));
const make = new Function('deps', `with(deps){${declarations.map(n => script.slice(n.start, n.end)).join('\n')}
  return {model:HandleFileImport,ui_image:HandleUiImageImport,actor:HandleActorImport,multimedia:HandleMultimediaImport};}`);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };
function fixture(type = 'model') {
  const created = [], refreshed = [], errors = [], events = [], media = [];
  const payload = {status:'success',archive_session:'archive',scene:'scene.ini',path:'asset',
    ...(type === 'multimedia' ? {media:{type:'audio',name:'Sound',path:'sound.wav',resource_id:'18446744073709551615'}} : {})};
  const result = {archive_session:'archive',scene:'scene.ini',name:'Created',actor_guid:'guid'};
  const deps = { currentSceneName:{value:'scene.ini'},archiveSession:{value:'archive'},selectedItem:{value:''},
    viewLifetime:{current:()=>true},ShowModelDropdown:{value:true},publishImportProgress:()=>{},
    reportImportError:(...v)=>errors.push(v),OnInitObjTree:async()=>{refreshed.push(true);},
    cabbageContextService:{recordEvent:v=>events.push(v)},addMediaToList:async v=>media.push(v),
    editorApi:{scene:{importResourceFile:async()=>payload,createActor:async(...v)=>{created.push(v);return result;}},
      sceneTools:{createActor:async(...v)=>{created.push(v);return result;}}},
  };
  const handlers = make(deps);
  return {deps,payload,result,created,refreshed,errors,events,media,run:()=>handlers[type]()};
}

test('Actor creation forwards captured scope without JSON or archive rediscovery', async t => {
  const previous = globalThis.window, stringify=JSON.stringify, parse=JSON.parse;
  t.after(()=>{globalThis.window=previous;JSON.stringify=stringify;JSON.parse=parse;});
  const calls=[], result={status:'success',actor:{actor_guid:'guid'}};
  globalThis.window={corona:{scene:{createActor:async(...v)=>{calls.push(v);return result;}}}};
  JSON.stringify=JSON.parse=()=>{throw Error('JSON transport forbidden');};
  const options={archive_session:'archive',actor_type:'audio',audio_resource_id:'18446744073709551615'};
  assert.equal(await editorApi.scene.createActor('scene.ini','sound.wav',options),result);
  assert.deepEqual(calls,[['scene.ini','sound.wav',options]]);
  assert.equal(editorApi.sceneTools,undefined);
});

for (const type of ['model','ui_image','actor','multimedia']) {
  test(`${type} import creates once under the originally observed archive`,async()=>{
    const f=fixture(type);await f.run();
    const audio=type==='multimedia';
    assert.deepEqual(f.created,[['scene.ini',audio?'sound.wav':'asset',{
      archive_session:'archive',actor_type:audio?'audio':type,
      ...(audio?{actor_name:'Sound',audio_resource_id:'18446744073709551615'}:{})}]]);
    assert.equal(f.refreshed.length,1);assert.equal(f.deps.selectedItem.value,'Created');assert.deepEqual(f.errors,[]);
  });
  for (const change of ['archive','scene','unmount']) {
    test(`${type} picker reply cannot create after ${change}`,async()=>{
      const f=fixture(type),pending=deferred();f.deps.editorApi.scene.importResourceFile=()=>pending.promise;
      const work=f.run();
      if(change==='archive')f.deps.archiveSession.value='new-archive';
      if(change==='scene')f.deps.currentSceneName.value='other.ini';
      if(change==='unmount')f.deps.viewLifetime.current=()=>false;
      pending.resolve(f.payload);await work;
      assert.deepEqual(f.created,[]);assert.deepEqual(f.refreshed,[]);assert.deepEqual(f.media,[]);
      assert.equal(f.deps.selectedItem.value,'');
    });
  }
}
for (const phase of ['creation','refresh']) {
  test(`a late ${phase} reply cannot select or publish into a replacement archive`,async()=>{
    const f=fixture(),pending=deferred();
    if(phase==='creation')f.deps.editorApi.scene.createActor=f.deps.editorApi.sceneTools.createActor=()=>pending.promise;
    else f.deps.OnInitObjTree=()=>pending.promise;
    const work=f.run();await new Promise(r=>setImmediate(r));
    f.deps.archiveSession.value='new-archive';pending.resolve(f.result);await work;
    assert.equal(f.deps.selectedItem.value,'');assert.deepEqual(f.events,[]);
    if(phase==='creation')assert.deepEqual(f.refreshed,[]);
  });
}
test('cancellation and mismatched picker scope never create Actors',async()=>{
  for(const patch of [{status:'canceled'},{archive_session:'other'},{scene:'other.ini'}]){
    const f=fixture();Object.assign(f.payload,patch);await f.run();assert.deepEqual(f.created,[]);
  }
});

test('a newer import supersedes an older outstanding picker without duplicate creation', async () => {
  const f=fixture(), first=deferred(), second=deferred();
  let count=0;
  f.deps.editorApi.scene.importResourceFile=()=>++count===1?first.promise:second.promise;
  const old=f.run(), recent=f.run();
  second.resolve(f.payload);await recent;
  first.resolve(f.payload);await old;
  assert.equal(f.created.length,1);assert.equal(f.refreshed.length,1);assert.equal(f.events.length,1);
});

test('video import stays a resource and does not create an audio Actor', async () => {
  const f=fixture('multimedia');f.payload.media.type='video';await f.run();
  assert.deepEqual(f.created,[]);assert.deepEqual(f.refreshed,[]);assert.deepEqual(f.media,[f.payload.media]);
});

test('native creation rejection reports failure without refreshing or selecting', async () => {
  const f=fixture();f.deps.editorApi.scene.createActor=async()=>{throw Error('creation failed');};
  await f.run();assert.equal(f.errors.length,1);assert.deepEqual(f.refreshed,[]);assert.equal(f.deps.selectedItem.value,'');
});
