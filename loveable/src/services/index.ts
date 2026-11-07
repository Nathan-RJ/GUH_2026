// Single entry point for all AI and data calls.
// Swap `mockService` for a real implementation (e.g. websocket-backed) here.
import { mockService } from "./mock";
import type { Reply2MeService } from "./types";
import { processDocument } from "./upload";

export const service: Reply2MeService = { ...mockService, processDocument };
export * from "./types";
export { scoreConcepts, overallState } from "./mock";
