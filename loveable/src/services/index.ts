// Single entry point for all AI and data calls.
// Swap `mockService` for a real implementation (e.g. websocket-backed) here.
import { DEMO_MODULE } from "./demo-data";
import { mockService } from "./mock";
import { groupIntoModules } from "./modules";
import type { Reply2MeService } from "./types";
import { processDocument } from "./upload";
import { getStudentModule } from "./lessons";

export const service: Reply2MeService = {
  ...mockService,
  processDocument,
  getStudentModule,
  // Uploaded modules (grouped by upload title), then the demo module that holds
  // the dashboard's seeded cohort data. If the catalogue can't load, just the demo.
  async getModules() {
    const uploaded = await getStudentModule()
      .then((m) => groupIntoModules(m.topics))
      .catch(() => []);
    return [...uploaded, DEMO_MODULE];
  },
};
export { getCachedLesson } from "./lessons";
export * from "./types";
export { scoreConcepts, overallState } from "./mock";
