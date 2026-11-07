import { afterEach, describe, expect, it, vi } from "vitest";
import { getStudentModule, getCachedLesson } from "./lessons";
import { createLessonSession } from "./mock";

const row = (id: string, title: string) => ({ lesson_id: id, title, student_brief: { summary: "New lesson summary", learning_objectives: ["Explain the topic"] } });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("student lesson catalogue", () => {
  it("fetches current lessons on every call and removes stale cached lessons", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ lessons: [row("one", "First lesson")] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ lessons: [row("two", "New teacher upload")] }) });
    vi.stubGlobal("fetch", fetcher);
    expect((await getStudentModule()).topics[0]?.title).toBe("First lesson");
    expect((await getStudentModule()).topics[0]?.lessonId).toBe("two");
    expect(getCachedLesson("one")).toBeUndefined();
    expect(getCachedLesson("two")?.title).toBe("New teacher upload");
    expect(fetcher).toHaveBeenCalledWith("/api/lessons", expect.objectContaining({ cache: "no-store" }));
  });

  it("supports an empty catalogue without demo fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lessons: [] }) }));
    expect((await getStudentModule()).topics).toEqual([]);
  });

  it("rejects HTTP failures and acknowledgements instead of returning demo data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: "Workflow unavailable" }) }));
    await expect(getStudentModule()).rejects.toThrow("Workflow unavailable");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message: "Workflow started" }) }));
    await expect(getStudentModule()).rejects.toThrow("invalid catalogue");
  });

  it("starts the selected uploaded lesson rather than the first demo topic", async () => {
    vi.useFakeTimers();
    const session = createLessonSession({ id: "new-id", lessonId: "new-id", title: "Probability", summary: "", concepts: [{ id: "objective-0", label: "Conditional probability" }] });
    const listener = vi.fn();
    session.subscribe(listener);
    await vi.advanceTimersByTimeAsync(400);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: "ai_reply", message: expect.objectContaining({ text: expect.stringContaining("probability") }) }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: "graph_update", concepts: [expect.objectContaining({ label: "Conditional probability" })] }));
    session.close();
  });
});
