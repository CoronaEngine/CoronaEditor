import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

// WNC-005: appService must route every window operation through the facade
// named bindings. The raw-corona call sites and the {cmd,...} switch are the
// redundant adapter this task deletes; window policy and session orchestration
// inside editorWindowSession stay untouched.

test('appService routes window operations through the facade without raw corona or a cmd switch', async () => {
  const source = await readFile(new URL('../../src/services/appService.js', import.meta.url), 'utf8');
  assert.equal(source.includes('window.corona'), false, 'appService must not touch raw window.corona');
  assert.equal(source.includes('switch (cmd)'), false, 'the {cmd,...} switch must be replaced by named facade operations');
});
