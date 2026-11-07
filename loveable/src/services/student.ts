// The real AI student for lessons: POST /api/student/reply on the Flask backend
// (backend/app/routes/student.py). Stateless: we send the conversation and what the
// student has learned so far, and get its reply plus what it learned this turn.
// In local dev, /api is proxied to Flask (vite.config.ts). Elsewhere set VITE_API_URL.
import type { TranscriptEntry } from "./marking";
import type { Topic } from "./types";

const BASE = ((import.meta.env["VITE_API_URL"] as string | undefined) ?? "").replace(/\/$/, "");

export interface StudentReply {
  reply: string;
  learned: string[];
  status: "ok" | "placeholder" | "failed";
  brief?: "lesson" | "public";
}

/** The student's reply to `message`, or its opening line when `message` is omitted. */
export async function askStudent(
  topic: Topic,
  transcript: TranscriptEntry[],
  learned: string[],
  message?: string,
): Promise<StudentReply> {
  const res = await fetch(`${BASE}/api/student/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lesson_id: topic.lessonId ?? "",
      topic: topic.title,
      summary: topic.summary,
      // Public learning objectives (cards replaced by marking criteria aren't objectives).
      objectives: topic.concepts.filter((c) => c.id.startsWith("objective-")).map((c) => c.label),
      transcript,
      message: message ?? "",
      learned,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data?.reply !== "string") throw new Error(data?.error ?? `The student couldn't reply (${res.status})`);
  return { reply: data.reply, learned: Array.isArray(data.learned) ? data.learned : [], status: data.status, brief: data.brief };
}
