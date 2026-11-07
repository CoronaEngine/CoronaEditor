/** Compatibility facade for the LAN chat and agent room APIs. */

import { editorApi } from '../api/editorApi.js';

const unwrap = (res) => (res && res.data !== undefined ? res.data : res);

export const lanChatService = {
  startRoom: (payload) => editorApi.lanChat.startRoom(payload).then(unwrap),
  startLocalRoom: (payload) => editorApi.lanChat.startLocalRoom(payload).then(unwrap),
  stopRoom: () => editorApi.lanChat.stopRoom().then(unwrap),
  stopLocalRoom: () => editorApi.lanChat.stopLocalRoom().then(unwrap),
  joinRoom: (payload) => editorApi.lanChat.joinRoom(payload).then(unwrap),
  listHistoryRooms: () => editorApi.lanChat.listHistoryRooms().then(unwrap),
  loadHistoryRoom: (room) => editorApi.lanChat.loadHistoryRoom(room).then(unwrap),
  leaveRoom: () => editorApi.lanChat.leaveRoom().then(unwrap),
  sendMessage: (text, options = {}) =>
    editorApi.lanChat.sendMessage(text, options).then(unwrap),
  getLocalIp: () => editorApi.lanChat.getLocalIp().then(unwrap),
  addAgent: (payload) => editorApi.lanChat.addAgent(payload).then(unwrap),
  removeAgent: (agentId) => editorApi.lanChat.removeAgent(agentId).then(unwrap),
};
