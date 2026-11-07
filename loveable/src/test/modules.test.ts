import { afterEach, describe, expect, it, vi } from "vitest";
import { applyMarking, type MarkingResult } from "@/services/marking";
import { DEMO_MODULE } from "@/services/demo-data";
import { findTopic, groupIntoModules } from "@/services/modules";
import { service, type Topic } from "@/services";

const lesson = (id: string, module: string, title = module): Topic => ({ id, lessonId: id, module, title, summary: "", concepts: [] });
const row = (id: string, title: string, topic?: string) => ({ lesson_id: id, title, student_brief: { summary: "s", learning_objectives: ["o"], ...(topic ? { topic } : {}) } });

describe("modules", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("groups uploaded lessons into one module per upload title", () => {
    const modules = groupIntoModules([
      lesson("a", "Probability 1"),
      lesson("b", "Bubble Sort"),
      lesson("c", "probability 1 ", "Conditional probability"), // same module, any case/spacing
    ]);
    expect(modules.map((m) => [m.title, m.topics.map((t) => t.id)])).toEqual([
      ["Probability 1", ["a", "c"]],
      ["Bubble Sort", ["b"]],
    ]);
    expect(new Set(modules.map((m) => m.id)).size).toBe(2);
  });

  it("the catalogue keeps the upload title as the module and the lesson topic as the card title", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lessons: [row("x", "Probability 1", "Sample spaces"), row("y", "Probability 1")] }) }));
    const { topics } = await service.getStudentModule();
    expect(topics.map((t) => [t.module, t.title])).toEqual([
      ["Probability 1", "Sample spaces"],
      ["Probability 1", "Probability 1"], // no topic given: falls back to the upload title
    ]);
  });

  it("getModules gives uploaded modules then the demo module", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lessons: [row("x", "Probability 1"), row("y", "Bubble Sort")] }) }));
    expect((await service.getModules()).map((m) => m.title)).toEqual(["Probability 1", "Bubble Sort", DEMO_MODULE.title]);
  });

  it("getModules still gives the demo module when the catalogue can't load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    expect((await service.getModules()).map((m) => m.id)).toEqual([DEMO_MODULE.id]);
  });

  it("finds a topic in whichever module holds it", () => {
    const modules = [...groupIntoModules([lesson("a", "Probability 1")]), DEMO_MODULE];
    expect(findTopic(modules, "a")?.module.title).toBe("Probability 1");
    expect(findTopic(modules, "recursion")?.module.title).toBe(DEMO_MODULE.title);
    expect(findTopic(modules, "nope")).toBeNull();
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
