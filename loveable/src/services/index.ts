// Single entry point for all AI and data calls.
// Swap `mockService` for a real implementation (e.g. websocket-backed) here.
import { mockService } from "./mock";
import type { Reply2MeService } from "./types";
import { processDocument } from "./upload";
import { getStudentModule, getCachedLesson } from "./lessons";
import { createLessonSession } from "./mock";

export const service: Reply2MeService = {
  ...mockService, processDocument, getStudentModule,
  startSession(topicId) {
    const topic = getCachedLesson(topicId);
    if (topic) return createLessonSession(topic);
    return mockService.startSession(topicId);
  },
};
export { getCachedLesson } from "./lessons";
export * from "./types";
export { scoreConcepts, overallState } from "./mock";
