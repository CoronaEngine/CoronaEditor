/**
 * AI, node-graph review/generation, and Cabbage workflow facade.
 *
 * The public C++ contract remains owned by `src/api/editorApi.js`; this file
 * adapts response shapes and operation names used by panels.
 */

import { editorApi } from '../api/editorApi.js';

// Match the Python chat service's array windows before normalizing individual entries.
const CHAT_MESSAGE_LIMIT = 24;
const CHAT_TASK_LIMIT = 20;
const CHAT_ACTOR_LIMIT = 80;
const DETAIL_GUIDANCE_PATTERN =
  /(不理解|看不懂|不会|怎么做|怎么连接|放在哪里|为什么还是不行|一步一步|具体步骤|展示|演示)/i;

export const aiService = {
  startNodeGraphReview: async (payload) => {
    const response = await editorApi.ai.submitRequest({
      operation: 'node_graph.review.start',
      payload: payload || {},
    });
    return response?.data ?? response;
  },
  getNodeGraphReviewStatus: async (taskId) => {
    const response = await editorApi.ai.submitRequest({
      operation: 'node_graph.review.status',
      taskId: String(taskId || ''),
    });
    return response?.data ?? response;
  },
  startCabbageChat({ assistant, requestId, locale, selectedTaskKey, tasks, content }) {
    const projectContext = assistant.projectContext;
    const actors = projectContext?.actors;
    return aiService.startNodeGraphReviewChat({
      requestId,
      locale,
      worldId: assistant.worldId,
      projectScopeId: assistant.projectScopeId,
      graphRevision: assistant.graphRevision,
      assistanceProfile: assistant.assistanceProfile,
      selectedTaskKey,
      tasks: tasks.slice(0, CHAT_TASK_LIMIT),
      graphExcerpt: assistant.graphExcerpt,
      projectContext: Array.isArray(actors)
        ? { ...projectContext, actors: actors.slice(0, CHAT_ACTOR_LIMIT) }
        : projectContext,
      messages: assistant.messages
        .slice(-CHAT_MESSAGE_LIMIT)
        .map(({ role, content }) => ({ role, content })),
      detailGuidanceRequested: DETAIL_GUIDANCE_PATTERN.test(content),
    });
  },
  startNodeGraphReviewChat: async (payload) => {
    const response = await editorApi.ai.submitRequest({
      operation: 'node_graph.review.chat.start',
      payload: payload || {},
    });
    return response?.data ?? response;
  },
  getNodeGraphReviewChatStatus: async (taskId) => {
    const response = await editorApi.ai.submitRequest({
      operation: 'node_graph.review.chat.status',
      taskId: String(taskId || ''),
    });
    return response?.data ?? response;
  },
  cancelNodeGraphReviewChat: async (taskId) => {
    const response = await editorApi.ai.submitRequest({
      operation: 'node_graph.review.chat.cancel',
      taskId: String(taskId || ''),
    });
    return response?.data ?? response;
  },
  startNodeGraphGeneration: async (payload) => {
    const response = await editorApi.ai.submitRequest({
      operation: 'node_graph.generate.start',
      payload: payload || {},
    });
    return response?.data ?? response;
  },
  getNodeGraphGenerationStatus: async (taskId) => {
    const response = await editorApi.ai.submitRequest({
      operation: 'node_graph.generate.status',
      taskId: String(taskId || ''),
    });
    return response?.data ?? response;
  },
  cancelNodeGraphGeneration: async (taskId) => {
    const response = await editorApi.ai.submitRequest({
      operation: 'node_graph.generate.cancel',
      taskId: String(taskId || ''),
    });
    return response?.data ?? response;
  },
  loadCabbageContext: async (payload = {}) => {
    const response = await editorApi.ai.submitRequest({
      operation: 'cabbage.context.load',
      payload,
    });
    return response?.data ?? response;
  },
  recordCabbageEvent: async (payload) => {
    const response = await editorApi.ai.submitRequest({
      operation: 'cabbage.context.record_event',
      payload: payload || {},
    });
    return response?.data ?? response;
  },
  updateCabbageTask: async (payload) => {
    const response = await editorApi.ai.submitRequest({
      operation: 'cabbage.context.update_task',
      payload: payload || {},
    });
    return response?.data ?? response;
  },
  appendCabbageMessage: async (payload) => {
    const response = await editorApi.ai.submitRequest({
      operation: 'cabbage.context.append_message',
      payload: payload || {},
    });
    return response?.data ?? response;
  },
  startCabbageGoalPlan: async (payload = {}) => {
    const response = await editorApi.ai.submitRequest({
      operation: 'cabbage.goal_plan.start',
      payload,
    });
    return response?.data ?? response;
  },
  getCabbageGoalPlanStatus: async (taskId) => {
    const response = await editorApi.ai.submitRequest({
      operation: 'cabbage.goal_plan.status',
      taskId: String(taskId || ''),
    });
    return response?.data ?? response;
  },
  startCabbageProfileScoreUpdate: async (payload = {}) => {
    const response = await editorApi.ai.submitRequest({
      operation: 'cabbage.profile.score.start',
      payload,
    });
    return response?.data ?? response;
  },
  getCabbageProfileScoreStatus: async (taskId) => {
    const response = await editorApi.ai.submitRequest({
      operation: 'cabbage.profile.score.status',
      taskId: String(taskId || ''),
    });
    return response?.data ?? response;
  },
};
