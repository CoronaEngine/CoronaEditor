import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../../src/', import.meta.url));

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(?:js|vue)$/.test(entry.name) ? [fullPath] : [];
  });
}

test('active project identity has no localStorage transport in production code', () => {
  const references = sourceFiles(sourceRoot).flatMap(file => {
    const source = fs.readFileSync(file, 'utf8');
    return source.includes('corona.activeProjectPath') ? [path.relative(sourceRoot, file)] : [];
  });
  assert.deepEqual(references, []);
});
