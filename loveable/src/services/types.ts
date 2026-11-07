// Shared contract between the UI and any backend (mock or real).

export type ConceptState = "not_covered" | "very_wrong" | "slightly_wrong" | "partial" | "correct";
export type SamMode = "curious" | "stubborn" | "challenge" | "exam";
export type DocKind = "content" | "exams" | "rubric";

export interface Concept {
  id: string;
  label: string;
  state: ConceptState;
  note?: string;
}

export interface Topic {
  id: string;
  title: string;
  summary: string;
  concepts: { id: string; label: string }[];
  /** A real lesson (n8n/Supabase). When set, the session is marked live by the
   *  Mark Session workflow and concept ids are the rubric's criterion ids. */
  lessonId?: string;
}

export interface Module {
  id: string;
  title: string;
  code: string;
  topics: Topic[];
}

export interface ChatMessage {
  id: string;
  from: "student" | "sam";
  text: string;
}

export interface Escalation {
  id: string;
  student: string;
  topicId: string;
  topicTitle: string;
  reason: string;
  at: string;
  reviewed: boolean;
}

export interface Misconception {
  topicTitle: string;
  percent: number;
  text: string;
}

export type CohortCounts = Record<ConceptState, number>;

export interface ExamResult {
  topicId: string;
  score: number;
  concepts: Concept[];
}

// Websocket event shapes the real backend will send.
export type SessionEvent =
  | { type: "student_message"; message: ChatMessage }
  | { type: "ai_reply"; message: ChatMessage }
  | { type: "graph_update"; concepts: Concept[] }
  | { type: "mode_change"; mode: SamMode }
  | { type: "guardrail_block"; message: string }
  | { type: "escalation"; reason: string }
  | { type: "exam_result"; result: ExamResult }
  | { type: "marking"; status: "started" | "done" | "failed"; score?: number; error?: string };

export interface TeachingSession {
  subscribe(cb: (e: SessionEvent) => void): () => void;
  sendMessage(text: string): void;
  finish(): void;
  close(): void;
}

export interface UploadedDoc {
  id: string;
  name: string;
  kind: DocKind;
  size: number;
}

export interface DocumentUpload {
  file: File;
  title: string;
  kind: DocKind;
}

export type DocumentResult =
  | { status: "draft"; lesson_id: string }
  | { status: "unconfirmed"; message: string };

export interface TopicRecord {
  state: ConceptState;
  score: number | null;
  attempts: number;
  concepts: Record<string, ConceptState>;
}

export interface StudentOverview {
  id: string;
  name: string;
  lastActive: string;
  topics: Record<string, TopicRecord>;
}

export interface Reply2MeService {
  getModule(): Promise<Module>;
  processDocument(doc: DocumentUpload, onUploaded?: () => void): Promise<DocumentResult>;
  /** The signed-in student's own progress only. */
  getMyProgress(): Promise<Record<string, TopicRecord>>;
  /** Teacher-only: every student's progress. */
  getStudents(): Promise<StudentOverview[]>;
  getCohort(): Promise<Record<string, CohortCounts>>;
  getMisconceptions(): Promise<Misconception[]>;
  getEscalations(): Promise<Escalation[]>;
  markReviewed(id: string): Promise<void>;
  startSession(topicId: string): TeachingSession;
  getDemoScript(topicId: string): string[];
  getLastResult(): ExamResult | null;
}
