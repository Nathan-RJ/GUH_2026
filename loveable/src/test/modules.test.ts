import { describe, expect, it } from "vitest";
import { applyMarking, type MarkingResult } from "@/services/marking";
import { BUBBLE_SORT_MODULE, DEMO_MODULE, FIXED_MODULES } from "@/services/demo-data";
import { findTopic } from "@/services/modules";
import { service } from "@/services";

describe("modules", () => {
  it("bubble sort has its own module, separate from the demo module", () => {
    expect(FIXED_MODULES.map((m) => m.title)).toEqual(["Bubble Sort", "Introduction to Programming"]);
    expect(BUBBLE_SORT_MODULE.topics.map((t) => t.id)).toEqual(["bubble-sort"]);
    expect(DEMO_MODULE.topics.some((t) => t.id === "bubble-sort")).toBe(false);
  });

  it("getModules returns every module with its own topics", async () => {
    const modules = await service.getModules();
    expect(modules.map((m) => m.id)).toEqual(["bubble-sort", "intro-prog"]);
  });

  it("finds a topic in whichever module holds it", () => {
    expect(findTopic(FIXED_MODULES, "bubble-sort")?.module.title).toBe("Bubble Sort");
    expect(findTopic(FIXED_MODULES, "recursion")?.module.title).toBe("Introduction to Programming");
    expect(findTopic(FIXED_MODULES, "nope")).toBeNull();
  });

  it("a topic without cards gets them from its first marking", () => {
    const result: MarkingResult = {
      session_id: "s",
      score: 25,
      feedback: {
        criteria: [
          { criterion_id: "sample_space", title: "Sample space", band: "full", marks_awarded: 25, max_marks: 25, evidence: [{ turn: 1, quote: "q" }] },
          { criterion_id: "independence", title: "Independence", band: "zero", marks_awarded: 0, max_marks: 25, evidence: [] },
        ],
      },
    };
    expect(applyMarking([], result).map((c) => [c.id, c.label, c.state])).toEqual([
      ["sample_space", "Sample space", "correct"],
      ["independence", "Independence", "not_covered"],
    ]);
  });
});
