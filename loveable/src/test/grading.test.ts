import { describe, expect, it } from "vitest";
import { scoreConcepts } from "@/services/mock";
import { service, type SessionEvent } from "@/services";
import { DEMO_MODULE } from "@/services/demo-data";
import type { Topic } from "@/services/types";

// A real lesson (marked live) and the demo topics (keyword graded).
const BUBBLE_SORT: Topic = {
  id: "b0454456-7c09-4401-a544-373e3bbc2f10",
  lessonId: "b0454456-7c09-4401-a544-373e3bbc2f10",
  module: "Bubble Sort",
  title: "Bubble sort",
  summary: "",
  concepts: [
    { id: "adjacent_comparisons", label: "Comparisons" },
    { id: "conditional_swaps", label: "Swaps" },
    { id: "repeated_passes", label: "Repeated passes" },
    { id: "stopping_conditions", label: "Stopping" },
  ],
};
const topic = (id: string): Topic => (id === "bubble-sort" ? BUBBLE_SORT : DEMO_MODULE.topics.find((t) => t.id === id)!);

describe("grading", () => {
  it("scores all-correct as 100 and all-uncovered as 0", () => {
    expect(scoreConcepts([{ id: "a", label: "A", state: "correct" }])).toBe(100);
    expect(scoreConcepts([{ id: "a", label: "A", state: "not_covered" }])).toBe(0);
  });

  it("marks 'base case is optional' as completely wrong and blocks it", async () => {
    const s = service.startSession(topic("recursion"));
    const events: SessionEvent[] = [];
    s.subscribe((e) => events.push(e));
    await s.sendMessage("The base case is optional.");
    const graph = events.filter((e) => e.type === "graph_update").at(-1);
    expect(graph && graph.type === "graph_update" && graph.concepts.find((c) => c.id === "base_case")?.state).toBe("very_wrong");
    expect(events.some((e) => e.type === "guardrail_block")).toBe(true);
    s.close();
  });
});
