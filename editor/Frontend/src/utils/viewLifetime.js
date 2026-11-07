/** Fence async setup and late native subscriptions after a view is retired. */
export function createViewLifetime(isCurrent = () => true) {
  let disposed = false;
  const subscriptions = new Set();
  const current = () => !disposed && isCurrent();
  return {
    current,
    dispose() {
      disposed = true;
      const releases = [...subscriptions];
      subscriptions.clear();
      return Promise.all(releases.map(release => release().catch(error => {
        console.warn('[ViewLifetime] failed to unsubscribe', error);
      })));
    },
    async subscribe(register, receive, unregister) {
      if (!current()) return null;
      const token = await register((...args) => { if (current()) return receive(...args); });
      if (token == null) return null;
      const release = async () => { await unregister(token); };
      if (current()) {
        subscriptions.add(release);
        return token;
      }
      await release();
      return null;
    },
  };
}
