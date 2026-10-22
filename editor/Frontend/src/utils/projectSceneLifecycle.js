export const resolveOpenedProjectScene = (payload = {}) => {
  const route = payload?.scene?.path;
  return typeof route === 'string' ? route.trim() : '';
};
