export function nextSaveAction({ succeeded, saveQueued, graphDirty, session, currentSession }) {
  return succeeded && session && session === currentSession && (saveQueued || graphDirty) ? 'resave' : 'idle';
}
