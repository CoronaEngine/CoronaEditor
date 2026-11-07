/** Compatibility facade for network sessions, locks, and sync queues. */

import { editorApi } from '../api/editorApi.js';

const unwrap = (res) => (res && res.data !== undefined ? res.data : res);

export const networkService = {
  startSession: (instanceName, projectId, port = 27960, role = 'host') =>
    editorApi.network.startSession(instanceName, projectId, port, role).then(unwrap),
  stopSession: () => editorApi.network.stopSession().then(unwrap),
  getSessionInfo: () => editorApi.network.getSessionInfo().then(unwrap),
  getDiscoveredPeers: () => editorApi.network.getDiscoveredPeers().then(unwrap),
  clearDiscoveredPeers: () => editorApi.network.clearDiscoveredPeers().then(unwrap),
  searchLan: () => editorApi.network.searchLan().then(unwrap),
  connectToPeer: (ip, port, peerName) =>
    editorApi.network.connectToPeer(ip, port, peerName).then(unwrap),
  setProjectRoot: (projectRoot) => editorApi.network.setProjectRoot(projectRoot).then(unwrap),
};
