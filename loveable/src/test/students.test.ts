import { describe, expect, it } from "vitest";
import { STUDENTS, blobColours, findStudent, randomStudent } from "@/voice/students";

describe("random students", () => {
  it("has five distinct students, each with its own voice and colour", () => {
    expect(STUDENTS).toHaveLength(5);
    expect(new Set(STUDENTS.map((s) => s.id)).size).toBe(5);
    expect(new Set(STUDENTS.map((s) => s.voice)).size).toBe(5);
    expect(new Set(STUDENTS.map((s) => s.hue)).size).toBe(5);
  });

  it("matches the backend's personality ids", () => {
    // backend/app/agents/personalities.py
    expect(STUDENTS.map((s) => s.id).sort()).toEqual([
      "dreamer",
      "eager",
      "knowitall",
      "sceptic",
      "shy",
    ]);
  });

  it("picks every student, across the whole random range", () => {
    expect(randomStudent(() => 0).id).toBe(STUDENTS[0]!.id);
    expect(randomStudent(() => 0.9999).id).toBe(STUDENTS[4]!.id);
    const seen = new Set(Array.from({ length: 200 }, () => randomStudent().id));
    expect(seen.size).toBe(5);
  });

  it("finds students by id", () => {
    expect(findStudent("shy")?.voice).toBe("liam");
    expect(findStudent("nobody")).toBeUndefined();
  });

  it("makes blob colours from the student's hue", () => {
    const c = blobColours({ hue: 240, chroma: 0.14 });
    expect(c.main).toBe("oklch(0.76 0.14 240)");
    expect(c.dark).toContain(" 250)");
  });
});
