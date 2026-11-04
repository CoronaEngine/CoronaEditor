/** Web AI orchestration. Native transport remains owned by editorApi. */
import { buildCabbageChatRequest } from './cabbageChatRequest.js';
import { modelService } from './aiModelService.js';
// Keep XML/catalog and non-chat workflows out of the ordinary-chat import path.
function workflow(name, ...args) {
  return import('./aiWorkflows.js').then(({ aiWorkflows }) => aiWorkflows[name](...args));
}

const chatGuidance = new Map();
export const aiService = {
  startCabbageChat: (input) => aiService.startNodeGraphReviewChat(buildCabbageChatRequest(input)),
  async startNodeGraphReviewChat(payload) {
    const prepared = payload.modelMessages
      ? payload
      : buildCabbageChatRequest({
          assistant: payload,
          requestId: payload.requestId,
          locale: payload.locale,
          selectedTaskKey: payload.selectedTaskKey,
          tasks: payload.tasks || [],
          content: payload.messages?.at(-1)?.content || '',
        });
    const result = await modelService.start({
      messages: prepared.modelMessages,
      options: { format: 'text', max_tokens: 1400, temperature: 0.25, timeout: 45 },
    });
    if (chatGuidance.size >= 128) chatGuidance.delete(chatGuidance.keys().next().value);
    chatGuidance.set(result.taskId, { requestId: prepared.requestId, guidance: prepared.guidance });
    return { ...result, requestId: prepared.requestId };
  },
  async getNodeGraphReviewChatStatus(taskId) {
    const status = await modelService.status(taskId);
    const request = chatGuidance.get(taskId);
    const metadata = status.status === 'completed' ? request?.guidance : null;
    return {
      ...status,
      requestId: request?.requestId || '',
      needsShowcase: false,
      guidanceIntent: '',
      steps: [],
      ...metadata,
    };
  },
  async cancelNodeGraphReviewChat(taskId) {
    const result = await modelService.cancel(taskId);
    if (result.status !== 'completed' && chatGuidance.has(taskId))
      chatGuidance.get(taskId).guidance = null;
    return result;
  },
  startNodeGraphReview: (payload) => workflow('startReview', payload),
  getNodeGraphReviewStatus: (taskId) => workflow('status', taskId),
  startNodeGraphGeneration: (payload) => workflow('startGeneration', payload),
  getNodeGraphGenerationStatus: (taskId) => workflow('status', taskId),
  cancelNodeGraphGeneration: (taskId) => workflow('cancel', taskId),
  loadCabbageContext: (payload) => workflow('load', payload),
  recordCabbageEvent: (payload) => workflow('recordEvent', payload),
  updateCabbageTask: (payload) => workflow('updateTask', payload),
  appendCabbageMessage: (payload) => workflow('appendMessage', payload),
  startCabbageGoalPlan: (payload) => workflow('startGoal', payload),
  getCabbageGoalPlanStatus: (taskId) => workflow('goalStatus', taskId),
  startCabbageProfileScoreUpdate: (payload) => workflow('startScore', payload),
  getCabbageProfileScoreStatus: (taskId) => workflow('status', taskId),
};
