// The five students you might get. One is picked at random each session, and each
// has its own personality, ElevenLabs voice and blob colour.
// Keep ids in sync with backend/app/agents/personalities.py (which tells the AI
// student how to behave) and voice names with backend/app/voice/settings.py.

export interface StudentType {
  id: string;
  label: string;
  /** One line telling the tutor what makes this student tricky. */
  blurb: string;
  /** ElevenLabs voice name (see backend VOICES). */
  voice: string;
  /** Blob colour, as an OKLCH hue (145 = the brand green). */
  hue: number;
  /** How vivid the colour is. */
  chroma: number;
}

export const STUDENTS: StudentType[] = [
  {
    id: "eager",
    label: "The eager one",
    blurb: "Jumps ahead and over-generalises. Keep them focused.",
    voice: "gigi",
    hue: 145,
    chroma: 0.19,
  },
  {
    id: "sceptic",
    label: "The sceptic",
    blurb: "Won't believe anything without an example.",
    voice: "jessica",
    hue: 355,
    chroma: 0.16,
  },
  {
    id: "dreamer",
    label: "The daydreamer",
    blurb: 'Drifts into "what if…" tangents. Keep it concrete.',
    voice: "laura",
    hue: 300,
    chroma: 0.16,
  },
  {
    id: "knowitall",
    label: "The know-it-all",
    blurb: "Confidently wrong. You'll have to prove it.",
    voice: "charlie",
    hue: 65,
    chroma: 0.16,
  },
  {
    id: "shy",
    label: "The quiet one",
    blurb: 'Says "I get it" when they don\'t. Check!',
    voice: "liam",
    hue: 240,
    chroma: 0.14,
  },
];

export function findStudent(id: string | null | undefined): StudentType | undefined {
  return STUDENTS.find((s) => s.id === id);
}

export function randomStudent(random: () => number = Math.random): StudentType {
  return STUDENTS[Math.floor(random() * STUDENTS.length)] ?? STUDENTS[0]!;
}

/** The blob's colours for a student. */
export function blobColours(student: Pick<StudentType, "hue" | "chroma">) {
  const { hue, chroma } = student;
  return {
    light: `oklch(0.92 ${(chroma * 0.65).toFixed(3)} ${hue})`,
    main: `oklch(0.76 ${chroma} ${hue})`,
    dark: `oklch(0.45 ${(chroma * 0.75).toFixed(3)} ${hue + 10})`,
    /** Eyebrows and mouth */
    feature: `oklch(0.17 0.03 ${hue})`,
  };
}
