// Live marking: send the whole transcript to the Flask backend (POST /api/mark),
// which forwards it to the n8n "Mark Session" workflow and returns the result.
// In local dev, /api is proxied to Flask (vite.config.ts). Elsewhere set VITE_API_URL.
import type { Concept, ConceptState } from "./types";

const BASE = ((import.meta.env["VITE_API_URL"] as string | undefined) ?? "").replace(/\/$/, "");

export interface TranscriptEntry {
  speaker: "user" | "assistant";
  text: string;
}

export interface CriterionResult {
  criterion_id: string;
  title: string;
  band: "full" | "partial" | "zero";
  marks_awarded: number;
  max_marks: number;
  evidence?: { turn: number; quote: string }[];
  /** How what the user taught compares with the rubric. Older replies may not have it. */
  status?: "correct" | "partially_correct" | "incorrect" | "not_covered";
  /** The user's wrong statements about this criterion, quoted. */
  incorrect_evidence?: { turn: number; quote: string }[];
  feedback?: string;
}

export interface MarkingResult {
  session_id: string;
  score: number;
  feedback: {
    summary?: string;
    strengths?: string[];
    next_steps?: string[];
    criteria?: CriterionResult[];
  };
}

export async function markTranscript(lessonId: string, transcript: TranscriptEntry[]): Promise<MarkingResult> {
  const res = await fetch(`${BASE}/api/mark`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lesson_id: lessonId, transcript }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Marking failed (${res.status})`);
  return data as MarkingResult;
}

/**
 * A marked criterion as a concept-card state:
 *   correct -> green, partially_correct -> light green (light red if part of it was wrong),
 *   incorrect -> red, not_covered -> grey.
 * Replies without a status fall back to the band.
 */
export function bandToState(c: CriterionResult): ConceptState {
  switch (c.status) {
    case "correct":
      return "correct";
    case "partially_correct":
      return c.incorrect_evidence?.length ? "slightly_wrong" : "partial";
    case "incorrect":
      return "very_wrong";
    case "not_covered":
      return "not_covered";
  }
  if (c.band === "full") return "correct";
  if (c.band === "partial") return "partial";
  return c.evidence?.length ? "very_wrong" : "not_covered";
}

/**
 * The topic's concepts updated from a marking result (matched by criterion_id).
 * Criteria without a card yet (e.g. a freshly uploaded lesson) get one added.
 */
export function applyMarking(concepts: Concept[], result: MarkingResult): Concept[] {
  const criteria = result.feedback?.criteria ?? [];
  const byId = new Map(criteria.map((c) => [c.criterion_id, c]));
  const known = new Set(concepts.map((c) => c.id));
  const added: Concept[] = criteria
    .filter((c) => !known.has(c.criterion_id))
    .map((c) => ({ id: c.criterion_id, label: c.title, state: "not_covered" }));
  return [...concepts, ...added].map((concept) => {
    const c = byId.get(concept.id);
    if (!c) return concept;
    const updated: Concept = { ...concept, state: bandToState(c) };
    if (c.feedback) updated.note = c.feedback;
    return updated;
  });
}
