import { afterEach, describe, expect, it, vi } from "vitest";
import { applyMarking, bandToState, type CriterionResult, type MarkingResult } from "@/services/marking";
import { service, type Concept, type SessionEvent } from "@/services";
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

  it("uses the marker's status when there is one, so wrong teaching shows red", () => {
    const wrong = [{ turn: 2, quote: "swap if the left is smaller" }];
    expect(bandToState({ ...criterion("a", "full", 1), status: "correct" })).toBe("correct");
    expect(bandToState({ ...criterion("a", "partial", 1), status: "partially_correct" })).toBe("partial");
    expect(bandToState({ ...criterion("a", "partial", 1), status: "partially_correct", incorrect_evidence: wrong })).toBe("slightly_wrong");
    expect(bandToState({ ...criterion("a", "zero"), status: "incorrect", incorrect_evidence: wrong })).toBe("very_wrong");
    expect(bandToState({ ...criterion("a", "zero"), status: "not_covered" })).toBe("not_covered");
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
  const isStudent = (url: unknown) => String(url).includes("/api/student/");
  const studentReply = () => new Response(JSON.stringify({ reply: "Tell me more?", learned: [], status: "ok" }));
  /** fetch that answers the AI student itself and passes marking calls to `mark`. */
  const routed = (mark: (n: number) => Promise<Response>) => {
    let n = 0;
    return vi.fn(async (url: unknown) => (isStudent(url) ? studentReply() : mark(++n)));
  };
  const markCalls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.filter(([url]) => !isStudent(url));

  it("sends the whole transcript after each message and recolours the cards", async () => {
    const fetchMock = routed(async () =>
      new Response(JSON.stringify(result(50, [criterion("adjacent_comparisons", "full", 1), criterion("conditional_swaps", "partial", 1)]))),
    );
    vi.stubGlobal("fetch", fetchMock);

    const s = service.startSession(topic("bubble-sort"));
    const events: SessionEvent[] = [];
    s.subscribe((e) => events.push(e));
    await s.sendMessage("Compare adjacent elements from left to right.");
    await s.sendMessage("Swap them if the left is bigger.");
    await flush();

    expect(markCalls(fetchMock)).toHaveLength(2);
    const [url, init] = markCalls(fetchMock)[1] as unknown as [string, RequestInit];
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
    const fetchMock = routed((n) =>
      n === 1
        ? new Promise<Response>((r) => (releaseFirst = r))
        : Promise.resolve(new Response(JSON.stringify(result(100, [criterion("adjacent_comparisons", "full", 1)])))),
    );
    vi.stubGlobal("fetch", fetchMock);

    const s = service.startSession(topic("bubble-sort"));
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
    vi.stubGlobal("fetch", routed(async () => new Response(JSON.stringify({ error: "n8n is down" }), { status: 502 })));
    const s = service.startSession(topic("bubble-sort"));
    const events: SessionEvent[] = [];
    s.subscribe((e) => events.push(e));
    await s.sendMessage("Compare neighbours.");
    await flush();
    expect(events).toContainEqual({ type: "marking", status: "failed", error: "n8n is down" });
    expect(events.some((e) => e.type === "ai_reply")).toBe(true);
    s.close();
  });

  it("does not call the marker or the AI student for demo topics", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const s = service.startSession(topic("recursion"));
    await s.sendMessage("Recursion is a function calling itself.");
    expect(fetchMock).not.toHaveBeenCalled();
    s.close();
  });
});
