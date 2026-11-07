import { describe, expect, it } from "vitest";
import { scoreConcepts } from "@/services/mock";
import { service, type SessionEvent } from "@/services";

describe("grading", () => {
  it("scores all-correct as 100 and all-uncovered as 0", () => {
    expect(scoreConcepts([{ id: "a", label: "A", state: "correct" }])).toBe(100);
    expect(scoreConcepts([{ id: "a", label: "A", state: "not_covered" }])).toBe(0);
  });

  it("marks 'base case is optional' as completely wrong and blocks it", async () => {
    const s = service.startSession("recursion");
    const events: SessionEvent[] = [];
    s.subscribe((e) => events.push(e));
    await s.sendMessage("The base case is optional.");
    const graph = events.filter((e) => e.type === "graph_update").at(-1);
    expect(graph && graph.type === "graph_update" && graph.concepts.find((c) => c.id === "base_case")?.state).toBe("very_wrong");
    expect(events.some((e) => e.type === "guardrail_block")).toBe(true);
    s.close();
  });
});
