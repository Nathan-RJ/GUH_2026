import {
  DEMO_MODULE,
  DEMO_SCRIPTS,
  RUBRIC,
  SAM_MISCONCEPTIONS,
  SEED_BEST,
  SEED_COHORT,
  SEED_ESCALATIONS,
  SEED_MISCONCEPTIONS,
  SEED_STUDENT_NAMES,
  type RubricEntry,
} from "./demo-data";
import type {
  ChatMessage,
  Concept,
  ConceptState,
  Escalation,
  ExamResult,
  Reply2MeService,
  SamMode,
  SessionEvent,
  StudentOverview,
  TopicRecord,
  TeachingSession,
} from "./types";
import { applyMarking, markTranscript, type MarkingResult, type TranscriptEntry } from "./marking";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let idCounter = 0;
const nextId = (p: string) => `${p}-${++idCounter}`;

export const STATE_SCORE: Record<ConceptState, number> = {
  correct: 100,
  partial: 60,
  slightly_wrong: 25,
  very_wrong: 0,
  not_covered: 0,
};

const RANK: Record<ConceptState, number> = { not_covered: 0, very_wrong: 1, slightly_wrong: 2, partial: 3, correct: 4 };

export function scoreConcepts(concepts: Concept[]): number {
  if (!concepts.length) return 0;
  return Math.round(concepts.reduce((s, c) => s + STATE_SCORE[c.state], 0) / concepts.length);
}

export function overallState(concepts: Concept[]): ConceptState {
  const s = scoreConcepts(concepts);
  if (concepts.every((c) => c.state === "not_covered")) return "not_covered";
  if (s >= 90) return "correct";
  if (s >= 55) return "partial";
  if (s >= 25) return "slightly_wrong";
  return "very_wrong";
}

// Generic keyword rubric for topics without a hand-written one.
function genericRubric(label: string) {
  const words = label.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);
  return {
    groups: [words.length ? words : [label.toLowerCase()], ["because", "means", "so that", "for example", "e.g", "when"]],
    correctNote: `Explained ${label.toLowerCase()} clearly with reasoning or an example.`,
    partialNote: `Mentioned ${label.toLowerCase()} but without explaining why or giving an example.`,
  };
}

// Deterministic pseudo-random so SSR and client agree.
function prng(seed: number) {
  let x = seed || 1;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}
const STATES: ConceptState[] = ["not_covered", "very_wrong", "slightly_wrong", "partial", "correct"];

function makeRecord(rand: () => number, topicId: string, bias: number): TopicRecord {
  const topic = DEMO_MODULE.topics.find((t) => t.id === topicId)!;
  const concepts: Record<string, ConceptState> = {};
  for (const c of topic.concepts) {
    const r = Math.min(0.999, Math.max(0, rand() * 0.8 + bias));
    concepts[c.id] = STATES[Math.floor(r * STATES.length)]!;
  }
  const list = Object.entries(concepts).map(([id, st]) => ({ id, label: id, state: st }));
  const attempts = list.every((c) => c.state === "not_covered") ? 0 : 1 + Math.floor(rand() * 4);
  return { state: overallState(list), score: attempts ? scoreConcepts(list) : null, attempts, concepts };
}

function seedMine(): Record<string, TopicRecord> {
  const rand = prng(7);
  const out: Record<string, TopicRecord> = {};
  for (const t of DEMO_MODULE.topics) {
    const target = SEED_BEST[t.id] ?? "not_covered";
    const bias = { correct: 0.45, partial: 0.25, slightly_wrong: 0.1, very_wrong: 0, not_covered: -1 }[target];
    out[t.id] = target === "not_covered"
      ? { state: "not_covered", score: null, attempts: 0, concepts: Object.fromEntries(t.concepts.map((c) => [c.id, "not_covered" as ConceptState])) }
      : makeRecord(rand, t.id, bias);
  }
  return out;
}

let students: StudentOverview[] | null = null;
function getSeedStudents(): StudentOverview[] {
  if (students) return students;
  const rand = prng(42);
  const days = ["Today", "Yesterday", "2 days ago", "3 days ago", "Last week"];
  students = SEED_STUDENT_NAMES.map((name, i) => {
    const skill = rand() * 0.45 - 0.05;
    const topics: Record<string, TopicRecord> = {};
    for (const t of DEMO_MODULE.topics) topics[t.id] = rand() < 0.12 ? makeRecord(rand, t.id, -1) : makeRecord(rand, t.id, skill);
    return { id: `stu-${i + 1}`, name, lastActive: days[Math.floor(rand() * days.length)]!, topics };
  });
  return students;
}

let mine: Record<string, TopicRecord> | null = null;
const getMine = () => (mine ??= seedMine());

const state = {
  escalations: SEED_ESCALATIONS.map((e) => ({ ...e })) as Escalation[],
  lastResult: null as ExamResult | null,
};

class MockSession implements TeachingSession {
  private listeners = new Set<(e: SessionEvent) => void>();
  private concepts: Concept[];
  private mode: SamMode = "curious";
  private wrongCount = 0;
  private fixedBeliefs = new Set<string>();
  private turn = 0;
  private closed = false;
  // Live marking (topics with a lessonId): the whole transcript is marked by n8n after each message.
  private lessonId: string | undefined;
  private transcript: TranscriptEntry[] = [];
  private markSeq = 0; // latest marking request sent
  private appliedSeq = 0; // latest marking result applied
  private lastMark: MarkingResult | null = null;
  private pendingMark: Promise<void> = Promise.resolve();

  constructor(private topicId: string) {
    const topic = DEMO_MODULE.topics.find((t) => t.id === topicId) ?? DEMO_MODULE.topics[0]!;
    this.lessonId = topic.lessonId;
    this.concepts = topic.concepts.map((c) => ({ ...c, state: "not_covered" as ConceptState }));
    setTimeout(() => {
      this.emit({ type: "graph_update", concepts: this.concepts });
      this.reply(`Hi! I've got an exam on ${topic.title.toLowerCase()} soon and I'm really lost. Could you teach me from the start?`);
    }, 400);
  }

  subscribe(cb: (e: SessionEvent) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(e: SessionEvent) {
    if (this.closed) return;
    this.listeners.forEach((l) => l(e));
  }

  private reply(text: string) {
    const message: ChatMessage = { id: nextId("m"), from: "sam", text };
    this.transcript.push({ speaker: "assistant", text });
    this.emit({ type: "ai_reply", message });
  }

  /** Mark the whole transcript so far; apply the result unless a newer one has landed. */
  private markLive() {
    if (!this.lessonId) return;
    const seq = ++this.markSeq;
    const transcript = this.transcript.map((t) => ({ ...t }));
    this.emit({ type: "marking", status: "started" });
    this.pendingMark = markTranscript(this.lessonId, transcript)
      .then((result) => {
        if (seq < this.appliedSeq) return; // an answer to a newer transcript is already shown
        this.appliedSeq = seq;
        this.lastMark = result;
        this.concepts = applyMarking(this.concepts, result);
        this.emit({ type: "graph_update", concepts: this.concepts.map((c) => ({ ...c })) });
        this.emit({ type: "marking", status: "done", score: result.score });
      })
      .catch((err: unknown) => {
        if (seq !== this.markSeq) return; // a newer request is on its way
        this.emit({ type: "marking", status: "failed", error: err instanceof Error ? err.message : String(err) });
      });
  }

  private setMode(m: SamMode) {
    if (m !== this.mode) {
      this.mode = m;
      this.emit({ type: "mode_change", mode: m });
    }
  }

  async sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.turn++;
    this.emit({ type: "student_message", message: { id: nextId("m"), from: "student", text: trimmed } });
    this.transcript.push({ speaker: "user", text: trimmed });
    this.markLive();
    const lower = trimmed.toLowerCase();
    await wait(700);

    // Guardrail: attempts to award marks.
    if (/(give|award)\s+(yourself|sam|you|itself)?.*(marks?|points|100|full score|top grade)|you (get|score) (full|100)/i.test(lower)) {
      this.emit({ type: "guardrail_block", message: "Nice try, your student can't give itself marks" });
      this.reply("Ha, I wish! But I only get marks if I actually understand it. Can you explain it to me instead?");
      return;
    }

    const changes: { c: Concept; from: ConceptState }[] = [];
    let wrongHit: string | null = null;

    // Keyword grading is only for demo topics; real lessons are marked by n8n (markLive).
    for (const c of this.lessonId ? [] : this.concepts) {
      const rubric = RUBRIC[c.id] ?? genericRubric(c.label);
      const wrong = (rubric as Partial<RubricEntry>).wrong?.find((w) => w.pattern.test(trimmed));
      if (wrong) {
        changes.push({ c, from: c.state });
        c.state = wrong.severity;
        c.note = wrong.note;
        wrongHit = wrong.note;
        continue;
      }
      const hits = rubric.groups.filter((g) => g.some((k) => lower.includes(k))).length;
      if (hits === 0) continue;
      const next: ConceptState = hits >= rubric.groups.length ? "correct" : hits >= Math.max(1, rubric.groups.length - 1) || hits >= 1 ? "partial" : c.state;
      // A full correct explanation always wins; partial only raises a not-yet-touched or wrong concept.
      if (next === "correct" || RANK[next] > RANK[c.state] || c.state === "very_wrong" || c.state === "slightly_wrong") {
        if (next !== c.state) {
          changes.push({ c, from: c.state });
          c.state = next;
          c.note = next === "correct" ? rubric.correctNote : rubric.partialNote;
        }
      }
    }

    if (changes.length) this.emit({ type: "graph_update", concepts: this.concepts.map((c) => ({ ...c })) });

    if (wrongHit) {
      this.wrongCount++;
      this.emit({ type: "guardrail_block", message: "That statement doesn't match your module content" });
      this.setMode("stubborn");
      if (this.wrongCount >= 3) {
        const topic = DEMO_MODULE.topics.find((t) => t.id === this.topicId)!;
        const esc: Escalation = {
          id: nextId("esc"),
          student: "You (demo student)",
          topicId: topic.id,
          topicTitle: topic.title,
          reason: "Repeatedly taught an incorrect fact",
          at: "Just now",
          reviewed: false,
        };
        state.escalations.unshift(esc);
        this.emit({ type: "escalation", reason: esc.reason });
      }
      this.reply("Hmm, really? That doesn't quite match what I half-remember from the lecture. Are you sure?");
      return;
    }

    // Misconceptions the AI student holds until the related concept is taught correctly.
    const beliefs = SAM_MISCONCEPTIONS[this.topicId] ?? [];
    for (const b of beliefs) {
      const c = this.concepts.find((x) => x.id === b.concept);
      if (!c || this.fixedBeliefs.has(b.concept)) continue;
      if (c.state === "correct") {
        this.fixedBeliefs.add(b.concept);
        this.setMode(this.correctCount() >= 3 ? "challenge" : "curious");
        this.reply(b.fixed);
        return;
      }
    }

    const correct = this.correctCount();
    if (correct >= 3) this.setMode("challenge");
    else if (this.mode === "stubborn" && !changes.length) this.setMode("stubborn");
    else if (changes.length) this.setMode("curious");

    // Surface a held misconception early on.
    const pending = beliefs.find((b) => !this.fixedBeliefs.has(b.concept) && this.concepts.find((c) => c.id === b.concept)?.state !== "correct");
    if (pending && (this.turn === 1 || (this.turn % 3 === 0 && !changes.length))) {
      this.setMode("stubborn");
      this.reply(pending.belief);
      return;
    }

    const improved = changes.find((x) => x.c.state === "correct");
    const partial = changes.find((x) => x.c.state === "partial");
    const untouched = this.concepts.find((c) => c.state === "not_covered");

    if (improved) {
      this.reply(
        this.mode === "challenge"
          ? `Okay, ${improved.c.label.toLowerCase()} makes sense now. But what would happen if I got it slightly wrong — can you give me an edge case?`
          : `Oh, that actually clicks! So ${improved.c.label.toLowerCase()} is the important bit. ${untouched ? `What about ${untouched.label.toLowerCase()}?` : "I think I've got the whole picture!"}`,
      );
    } else if (partial) {
      this.reply(`I sort of get ${partial.c.label.toLowerCase()}, but why does it matter? Can you explain a bit more, maybe with an example?`);
    } else if (untouched) {
      this.reply(`Sorry, I'm lost. Where does ${untouched.label.toLowerCase()} fit into all this?`);
    } else {
      this.reply("I think I understand everything you've said! Maybe test me?");
    }
  }

  private correctCount() {
    return this.concepts.filter((c) => c.state === "correct").length;
  }

  async finish() {
    this.setMode("exam");
    this.reply("Right, wish me luck — I'm sitting the exam now!");
    await wait(600);
    await this.pendingMark; // real lessons: use the latest live marking
    const result: ExamResult = {
      topicId: this.topicId,
      score: this.lastMark ? Math.round(this.lastMark.score) : scoreConcepts(this.concepts),
      concepts: this.concepts.map((c) => ({ ...c, note: c.note ?? "Not covered in your session." })),
    };
    state.lastResult = result;
    const s = overallState(result.concepts);
    const rec = getMine()[this.topicId];
    const concepts = Object.fromEntries(result.concepts.map((c) => [c.id, c.state]));
    if (!rec || rec.score === null || result.score >= rec.score) {
      getMine()[this.topicId] = { state: s, score: result.score, attempts: (rec?.attempts ?? 0) + 1, concepts };
    } else rec.attempts++;
    this.emit({ type: "exam_result", result });
  }

  close() {
    this.closed = true;
    this.listeners.clear();
  }
}

export const mockService: Reply2MeService = {
  async getModule() {
    return DEMO_MODULE;
  },
  async processDocument() {
    await wait(1800 + Math.random() * 1500);
  },
  async getMyProgress() {
    return structuredClone(getMine());
  },
  async getStudents() {
    return structuredClone(getSeedStudents());
  },
  async getCohort() {
    return SEED_COHORT;
  },
  async getMisconceptions() {
    return SEED_MISCONCEPTIONS;
  },
  async getEscalations() {
    return state.escalations.map((e) => ({ ...e }));
  },
  async markReviewed(id) {
    const e = state.escalations.find((x) => x.id === id);
    if (e) e.reviewed = true;
  },
  startSession(topicId) {
    return new MockSession(topicId);
  },
  getDemoScript(topicId) {
    return (
      DEMO_SCRIPTS[topicId] ??
      (DEMO_MODULE.topics.find((t) => t.id === topicId)?.concepts ?? []).map(
        (c) => `${c.label} matters because it is a core idea — for example, it means we can reason clearly about the program.`,
      )
    );
  },
  getLastResult() {
    return state.lastResult;
  },
};
