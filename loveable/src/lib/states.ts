import type { ConceptState } from "@/services/types";

export const STATE_META: Record<ConceptState, { label: string; short: string; fill: string; bg: string; text: string }> = {
  correct: { label: "Accurate and complete", short: "Strong", fill: "var(--state-correct)", bg: "bg-state-correct", text: "text-state-correct" },
  partial: { label: "On the right track", short: "Incomplete", fill: "var(--state-partial)", bg: "bg-state-partial", text: "text-state-partial" },
  slightly_wrong: { label: "Wrong, but not far off", short: "Nearly", fill: "var(--state-slightly-wrong)", bg: "bg-state-slightly-wrong", text: "text-state-slightly-wrong" },
  very_wrong: { label: "Completely wrong", short: "Wrong", fill: "var(--state-very-wrong)", bg: "bg-state-very-wrong", text: "text-state-very-wrong" },
  not_covered: { label: "Not covered yet", short: "Not covered", fill: "var(--state-none)", bg: "bg-state-none", text: "text-muted-foreground" },
};

export const STATE_ORDER: ConceptState[] = ["correct", "partial", "slightly_wrong", "very_wrong", "not_covered"];
