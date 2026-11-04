import blockProgram from './runtime/block_program.py?raw';

// Direct file operations need no generated game helpers.
const fileOperations = new Set(['wait', 'check_stop', 'mark', 'mark_waiting', 'register_key_handler',
  'keyboard', 'translate_actor']);

export function emitFileProgram([header, ...chunks]) {
  const body = chunks.join('\n');
  const calls = [...body.matchAll(/\bCoronaEngine\.(\w+)/g)].map(match => match[1]);
  let helpers = 'from script_runtime import file_api as CoronaEngine';
  if (calls.some(name => !fileOperations.has(name))) {
    // Keep block helper names outside the namespace of user-defined procedures.
    helpers = [
      'from types import SimpleNamespace as _BlockNamespace',
      'def _make_block_program():',
      blockProgram.trimEnd().split('\n').map(line => line ? '    ' + line : '').join('\n'),
      '    _current_context()',
      '    return _BlockNamespace(**locals())',
      'CoronaEngine = _make_block_program()',
    ].join('\n');
  }
  return [header, 'from __future__ import annotations', helpers, body, ''].join('\n');
}
