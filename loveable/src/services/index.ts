// Single entry point for all AI and data calls.
// Swap `mockService` for a real implementation (e.g. websocket-backed) here.
import { mockService } from "./mock";
import type { Reply2MeService } from "./types";

export const service: Reply2MeService = mockService;
export * from "./types";
export { scoreConcepts, overallState } from "./mock";
