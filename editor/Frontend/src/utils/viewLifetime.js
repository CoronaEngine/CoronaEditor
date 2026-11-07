/** Fence async setup and late native subscriptions after a view is retired. */
export function createViewLifetime(isCurrent = () => true) {
  let disposed = false;
  const current = () => !disposed && isCurrent();
  return {
    current,
    dispose() { disposed = true; },
    async subscribe(register, receive, unregister) {
      if (!current()) return null;
      const token = await register((...args) => { if (current()) return receive(...args); });
      if (current()) return token;
      await unregister(token);
      return null;
    },
  };
}
