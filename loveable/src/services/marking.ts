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

/** A rubric band as a concept-card state. "zero" with evidence means they tried and got it wrong. */
export function bandToState(c: CriterionResult): ConceptState {
  if (c.band === "full") return "correct";
  if (c.band === "partial") return "partial";
  return c.evidence?.length ? "very_wrong" : "not_covered";
}

/** The topic's concepts updated from a marking result (matched by criterion_id). */
export function applyMarking(concepts: Concept[], result: MarkingResult): Concept[] {
  const byId = new Map((result.feedback?.criteria ?? []).map((c) => [c.criterion_id, c]));
  return concepts.map((concept) => {
    const c = byId.get(concept.id);
    if (!c) return concept;
    const updated: Concept = { ...concept, state: bandToState(c) };
    if (c.feedback) updated.note = c.feedback;
    return updated;
  });
}
