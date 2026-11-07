import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const sourceRoot = path.resolve(import.meta.dirname, '../../src');
const retired = ['sceneService', 'fileService', 'projectService', 'projectSettingsService', 'scriptingService'];
const sources = fs.readdirSync(sourceRoot, { recursive: true })
  .filter(file => /\.(js|vue)$/.test(file));

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
