import { afterEach, describe, expect, it, vi } from "vitest";
import { service, type SessionEvent, type Topic } from "@/services";

const LESSON: Topic = {
  id: "lesson-1",
  lessonId: "lesson-1",
  module: "Bubble Sort",
  title: "Bubble sort",
  summary: "Teach how bubble sort works.",
  concepts: [{ id: "objective-0", label: "Describe which elements are compared." }],
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("AI student for real lessons", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("answers with the AI student's reply, not a scripted one, and sends what it learned back", async () => {
    const studentBodies: Record<string, unknown>[] = [];
    const replies = [
      { reply: "Hi! I'm new to bubble sort.", learned: [], status: "ok" },
      { reply: "So I only compare neighbours?", learned: ["You compare neighbouring elements."], status: "ok" },
      { reply: "Got it. When do I swap?", learned: [], status: "ok" },
    ];
    vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes("/api/student/")) {
        studentBodies.push(JSON.parse(init!.body as string));
        return new Response(JSON.stringify(replies[studentBodies.length - 1]));
      }
      return new Response(JSON.stringify({ session_id: "s", score: 0, feedback: { criteria: [] } }));
    }));

    const s = service.startSession(LESSON);
    const events: SessionEvent[] = [];
    s.subscribe((e) => events.push(e));
    await wait(450); // opening
    await s.sendMessage("You compare neighbouring elements.");
    await s.sendMessage("Left to right.");

    const said = events.filter((e) => e.type === "ai_reply").map((e) => (e.type === "ai_reply" ? e.message.text : ""));
    expect(said).toEqual(["Hi! I'm new to bubble sort.", "So I only compare neighbours?", "Got it. When do I swap?"]);
    expect(said.some((t) => t.includes("Where does"))).toBe(false); // no scripted dead end

    expect(studentBodies[0]).toMatchObject({ lesson_id: "lesson-1", topic: "Bubble sort", message: "", objectives: ["Describe which elements are compared."] });
    expect(studentBodies[1]).toMatchObject({ message: "You compare neighbouring elements.", learned: [] });
    expect(studentBodies[2]).toMatchObject({ message: "Left to right.", learned: ["You compare neighbouring elements."] });
    const transcript = studentBodies[2]!["transcript"] as { speaker: string; text: string }[];
    expect(transcript.map((t) => t.speaker)).toEqual(["assistant", "user", "assistant", "user"]);
    s.close();
  });

  it("keeps the session going if the AI student is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "down" }), { status: 502 })));
    const s = service.startSession(LESSON);
    const events: SessionEvent[] = [];
    s.subscribe((e) => events.push(e));
    await s.sendMessage("Hello");
    const said = events.filter((e) => e.type === "ai_reply").map((e) => (e.type === "ai_reply" ? e.message.text : ""));
    expect(said).toContain("Sorry, I lost my train of thought. Could you say that again?");
    s.close();
  });
});
