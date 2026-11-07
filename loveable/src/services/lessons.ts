import type { Module, Topic } from "./types";

const topics = new Map<string, Topic>();
export const getCachedLesson = (id: string) => topics.get(id);

export async function getStudentModule(): Promise<Module> {
  const base = (import.meta.env["VITE_API_BASE_URL"] ?? import.meta.env["VITE_API_URL"] ?? "").replace(/\/$/, "");
  const response = await fetch(`${base}/api/lessons`, { cache: "no-store", signal: AbortSignal.timeout(35_000) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : `Could not load lessons (${response.status}).`);
  if (!data || !Array.isArray(data.lessons)) throw new Error("The lesson service returned an invalid catalogue.");
  const loaded: Topic[] = data.lessons.map((row: unknown) => {
    if (!row || typeof row !== "object") throw new Error("Invalid lesson in catalogue.");
    const lesson = row as Record<string, unknown>;
    const brief = lesson["student_brief"] as Record<string, unknown> | undefined;
    if (typeof lesson["lesson_id"] !== "string" || !lesson["lesson_id"] || typeof lesson["title"] !== "string" || !brief || typeof brief !== "object") throw new Error("Invalid lesson in catalogue.");
    const objectives = Array.isArray(brief["learning_objectives"]) ? brief["learning_objectives"].filter((value): value is string => typeof value === "string") : [];
    return {
      id: lesson["lesson_id"], lessonId: lesson["lesson_id"], title: lesson["title"],
      summary: typeof brief["summary"] === "string" ? brief["summary"] : "",
      concepts: objectives.map((label, index) => ({ id: `objective-${index}`, label })),
    };
  });
  topics.clear();
  loaded.forEach(topic => topics.set(topic.id, topic));
  return { id: "uploaded-lessons", title: "Your lessons", code: "", topics: loaded };
}
