import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

// WNC-006: capability probing lives in the facade. Components and services may
// only consume facade capability queries; raw window.corona is facade-only.

test('capability probing is centralized in the facade, not components', async () => {
  for (const file of ['../../src/App.vue', '../../src/services/projectLauncherService.js']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.equal(source.includes('window.corona'), false, `${file} must not probe raw window.corona`);
  }
});
