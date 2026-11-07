import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

const sourceRoot = path.resolve(import.meta.dirname, '../../src');
const retired = ['sceneService', 'fileService', 'projectService', 'projectSettingsService', 'scriptingService', 'networkService', 'lanChatService'];
const sources = fs.readdirSync(sourceRoot, { recursive: true })
  .filter(file => /\.(js|vue)$/.test(file));

test('unused project launch operations have no Web facade or production consumer', () => {
  for (const method of ['browseFolder', 'getDefaultProjectPath', 'createProject',
    'validatePortableScene', 'importPortableAsset', 'cleanupPortableSceneAssets']) {
    assert.equal(editorApi.project[method], undefined, method);
    for (const file of sources) {
      assert.doesNotMatch(fs.readFileSync(path.join(sourceRoot, file), 'utf8'),
        new RegExp(`\\b${method}\\b`), `${method}: ${file}`);
    }
  }
});

test('project launcher service keeps orchestration without duplicate forwarding methods', () => {
  const source = fs.readFileSync(path.join(sourceRoot, 'services/projectLauncherService.js'), 'utf8');
  for (const method of ['getAppVersion', 'getRecentProjects', 'getProjectLoadStatus',
    'openProjectFile', 'createWorldProject', 'createMultiplayerProject']) {
    assert.doesNotMatch(source, new RegExp(`^  ${method}:`, 'm'), method);
  }
});

test('unused resource search web namespace is absent and has no production consumers', () => {
  assert.equal(editorApi.resourceSearch, undefined);
  for (const file of sources) {
    assert.doesNotMatch(fs.readFileSync(path.join(sourceRoot, file), 'utf8'), /\bresourceSearch\b|\bResourceSearch\b/, file);
  }
});

test('unused compatibility facades are absent and cannot acquire new production callers', () => {
  for (const name of retired) {
    assert.equal(fs.existsSync(path.join(sourceRoot, 'services', name + '.js')), false, name);
    const importPattern = new RegExp(`(?:from\\s*|import\\s*\\()['"][^'"]*/${name}\\.js['"]`);
    for (const file of sources) {
      assert.doesNotMatch(fs.readFileSync(path.join(sourceRoot, file), 'utf8'), importPattern, file);
    }
  }
});

test('retired bridge error messages no longer appear in the DOM translation catalog', () => {
  const source = fs.readFileSync(path.join(sourceRoot, 'i18n/domTranslator.js'), 'utf8');
  assert.equal(/coronaBridge\.(?:actorTransform|cameraMove)|coronaBridge 缺失/.test(source), false);
});


test('unused network Web methods and forwarding wrappers are absent', () => {
  for (const method of [
    'broadcastActorCreate', 'broadcastActorDelete', 'broadcastActorStateUpdate',
    'broadcastActorTransform', 'broadcastIntent', 'broadcastSceneSnapshot',
    'checkPreviewCollision', 'claimActorOwnership', 'getLockOwner',
    'getPeerCount', 'lockObject', 'pollPendingActorCreate',
    'pollPendingActorDelete', 'pollPendingActorStateUpdate', 'pollPendingActorTransform',
    'pollPendingSceneSnapshot', 'pollPendingSceneSnapshotRequest', 'registerActorIdentity',
    'requestSceneSnapshot', 'setSyncPaused', 'unlockObject',
  ]) {
    assert.equal(editorApi.network[method], undefined, method);
    for (const file of sources) {
      assert.doesNotMatch(fs.readFileSync(path.join(sourceRoot, file), 'utf8'),
        new RegExp(`\\b${method}\\b`), `${method}: ${file}`);
    }
  }
});


test('unused lanChat Web methods and forwarding wrappers are absent', () => {
  for (const method of [
    'getHistory', 'listAgents', 'pollAgentTrigger',
    'pollCoordinatorSyncMessage', 'pollRoomEvent', 'pollSyncEvent',
    'sendAgentReply', 'sendSystemMessage', 'sendSystemMessageToHost',
    'sendSystemMessageToUser',
  ]) {
    assert.equal(editorApi.lanChat[method], undefined, method);
    for (const file of sources) {
      assert.doesNotMatch(fs.readFileSync(path.join(sourceRoot, file), 'utf8'),
        new RegExp(`\\b${method}\\b`), `${method}: ${file}`);
    }
  }
});
