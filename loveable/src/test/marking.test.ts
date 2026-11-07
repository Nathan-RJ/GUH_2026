import { afterEach, describe, expect, it, vi } from "vitest";
import { applyMarking, bandToState, type CriterionResult, type MarkingResult } from "@/services/marking";
import { service, type Concept, type SessionEvent } from "@/services";

const criterion = (id: string, band: CriterionResult["band"], evidence = 0): CriterionResult => ({
  criterion_id: id,
  title: id,
  band,
  marks_awarded: band === "full" ? 25 : band === "partial" ? 12 : 0,
  max_marks: 25,
  evidence: Array.from({ length: evidence }, (_, i) => ({ turn: i + 1, quote: "q" })),
  feedback: `${id} feedback`,
});

const result = (score: number, criteria: CriterionResult[]): MarkingResult => ({
  session_id: "s",
  score,
  feedback: { summary: "x", criteria },
});

describe("bandToState", () => {
  it("maps rubric bands to card states", () => {
    expect(bandToState(criterion("a", "full"))).toBe("correct");
    expect(bandToState(criterion("a", "partial"))).toBe("partial");
    expect(bandToState(criterion("a", "zero"))).toBe("not_covered"); // never mentioned
    expect(bandToState(criterion("a", "zero", 1))).toBe("very_wrong"); // tried, got it wrong
  });
});

describe("applyMarking", () => {
  it("updates matching concepts and leaves the rest alone", () => {
    const concepts: Concept[] = [
      { id: "adjacent_comparisons", label: "Comparisons", state: "not_covered" },
      { id: "other", label: "Other", state: "partial" },
    ];
    const out = applyMarking(concepts, result(25, [criterion("adjacent_comparisons", "full")]));
    expect(out[0]).toMatchObject({ state: "correct", note: "adjacent_comparisons feedback" });
    expect(out[1]).toEqual(concepts[1]);
  });
});

describe("live marking in a lesson session", () => {
  afterEach(() => vi.unstubAllGlobals());

  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("sends the whole transcript after each message and recolours the cards", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(result(50, [criterion("adjacent_comparisons", "full", 1), criterion("conditional_swaps", "partial", 1)]))),
    );
    vi.stubGlobal("fetch", fetchMock);

    const s = service.startSession("bubble-sort");
    const events: SessionEvent[] = [];
    s.subscribe((e) => events.push(e));
    await s.sendMessage("Compare adjacent elements from left to right.");
    await s.sendMessage("Swap them if the left is bigger.");
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/mark$/);
    const body = JSON.parse(init.body as string);
    expect(body.lesson_id).toBe("b0454456-7c09-4401-a544-373e3bbc2f10");
    const userLines = body.transcript.filter((t: { speaker: string }) => t.speaker === "user").map((t: { text: string }) => t.text);
    expect(userLines).toEqual(["Compare adjacent elements from left to right.", "Swap them if the left is bigger."]);

    const graph = events.filter((e) => e.type === "graph_update").at(-1);
    const states = graph?.type === "graph_update" ? Object.fromEntries(graph.concepts.map((c) => [c.id, c.state])) : {};
    expect(states).toEqual({
      adjacent_comparisons: "correct",
      conditional_swaps: "partial",
      repeated_passes: "not_covered",
      stopping_conditions: "not_covered",
    });
    expect(events.some((e) => e.type === "marking" && e.status === "done" && e.score === 50)).toBe(true);
    s.close();
  });

  it("ignores an older result that arrives after a newer one", async () => {
    let releaseFirst: (r: Response) => void = () => {};
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((r) => (releaseFirst = r)))
      .mockImplementationOnce(async () => new Response(JSON.stringify(result(100, [criterion("adjacent_comparisons", "full", 1)]))));
    vi.stubGlobal("fetch", fetchMock);

    const s = service.startSession("bubble-sort");
    const events: SessionEvent[] = [];
    s.subscribe((e) => events.push(e));
    await s.sendMessage("first");
    await s.sendMessage("second");
    await flush();
    releaseFirst(new Response(JSON.stringify(result(0, [criterion("adjacent_comparisons", "zero")]))));
    await flush();

    const graph = events.filter((e) => e.type === "graph_update").at(-1);
    expect(graph?.type === "graph_update" && graph.concepts.find((c) => c.id === "adjacent_comparisons")?.state).toBe("correct");
    s.close();
  });

  it("reports a failure without breaking the session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "n8n is down" }), { status: 502 })));
    const s = service.startSession("bubble-sort");
    const events: SessionEvent[] = [];
    s.subscribe((e) => events.push(e));
    await s.sendMessage("Compare neighbours.");
    await flush();
    expect(events).toContainEqual({ type: "marking", status: "failed", error: "n8n is down" });
    expect(events.some((e) => e.type === "ai_reply")).toBe(true);
    s.close();
  });

  it("does not call the marker for demo topics", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const s = service.startSession("recursion");
    await s.sendMessage("Recursion is a function calling itself.");
    expect(fetchMock).not.toHaveBeenCalled();
    s.close();
  });
});
