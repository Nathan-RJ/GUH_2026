import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mic, MicOff, Volume2, VolumeX, Flag, Keyboard, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { service, type Concept, type SamMode, type TeachingSession, type Topic } from "@/services";
import { ConceptMap } from "@/components/ConceptMap";
import { StateLegend } from "@/components/StateLegend";
import { StudentBlob, type BlobMood, type BlobSpeaker } from "@/components/student-blob";
import { Eyebrow } from "@/components/Eyebrow";
import { Button } from "@/components/ui/button";
import { blobColours, randomStudent, useStudentVoice, type StudentType } from "@/voice";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/student/teach/$topicId")({
  head: ({ params }) => {
    const t = "your lesson";
    return {
      meta: [
        { title: `Teach ${t} — Reply 2 Me` },
        { name: "description", content: `Explain ${t} out loud to an AI student and watch the concept map light up.` },
        { property: "og:title", content: `Teach ${t} — Reply 2 Me` },
        { property: "og:description", content: `Explain ${t} out loud to an AI student.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: TeachPage,
});

const MODE_META: Record<SamMode, { label: string; dot: string }> = {
  curious: { label: "Curious", dot: "bg-brand" },
  stubborn: { label: "Stubborn", dot: "bg-state-very-wrong" },
  challenge: { label: "Challenge", dot: "bg-warning" },
  exam: { label: "Exam", dot: "bg-ink-foreground" },
};

function TeachPage() {
  const { topicId } = Route.useParams();
  const { data, isPending, error, refetch } = useQuery({ queryKey: ["student-lessons"], queryFn: () => service.getStudentModule(), retry: 1 });
  if (isPending) return <main className="p-10">Loading lesson…</main>;
  if (error) return <main className="p-10"><p role="alert">{error.message}</p><Button onClick={() => void refetch()}>Try again</Button></main>;
  const topic = data?.topics.find(t => t.id === topicId);
  if (!topic) return <main className="p-10">This lesson is no longer available. Return to the student lesson list.</main>;
  return <TeachSession key={topic.id} topic={topic} />;
}

function TeachSession({ topic }: { topic: Topic }) {
  const { topicId } = Route.useParams();
  const navigate = useNavigate();
  const [concepts, setConcepts] = useState<Concept[]>(topic.concepts.map((c) => ({ ...c, state: "not_covered" })));
  const [mode, setMode] = useState<SamMode>("curious");
  const [muted, setMuted] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [aiLine, setAiLine] = useState("");
  const [youLine, setYouLine] = useState("");
  const [typeOpen, setTypeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  // Live marking (real lessons only): how many checks are running, and the latest score.
  const [marking, setMarking] = useState<{ running: number; score: number | null }>({ running: 0, score: null });
  const sessionRef = useRef<TeachingSession | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const send = (text: string) => {
    if (!text.trim()) return;
    voiceRef.current.stop();
    setAiSpeaking(false);
    sessionRef.current?.sendMessage(text);
    setDraft("");
  };
  // ElevenLabs voice (falls back to the browser's voice): see src/voice/
  // A random student each session: its own personality, voice and colour (src/voice/students.ts).
  // Picked after mount so the server-rendered page and the browser agree.
  const [student, setStudent] = useState<StudentType | null>(null);
  useEffect(() => setStudent(randomStudent()), [topicId]);
  const voice = useStudentVoice({ onFinal: send, onError: (msg) => toast.error(msg), voice: student?.voice });
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  useEffect(() => {
    const s = service.startSession(topic.id);
    sessionRef.current = s;
    let fakeTimer: ReturnType<typeof setTimeout>;
    const unsub = s.subscribe((e) => {
      switch (e.type) {
        case "student_message":
          setYouLine(e.message.text);
          setThinking(true);
          break;
        case "ai_reply": {
          setThinking(false);
          setAiLine(e.message.text);
          setYouLine("");
          const end = () => setAiSpeaking(false);
          setAiSpeaking(true);
          if (!mutedRef.current) {
            voiceRef.current.speak(e.message.text, { onEnd: end });
          } else {
            clearTimeout(fakeTimer);
            fakeTimer = setTimeout(end, Math.min(6000, e.message.text.length * 50));
          }
          break;
        }
        case "graph_update":
          setConcepts(e.concepts);
          break;
        case "mode_change":
          setMode(e.mode);
          break;
        case "guardrail_block":
          toast.warning(e.message);
          break;
        case "escalation":
          toast.error("This session has been flagged for your teacher to review", { description: e.reason });
          break;
        case "exam_result":
          setTimeout(() => navigate({ to: "/student/results" }), 400);
          break;
        case "marking":
          setMarking((m) => ({
            running: Math.max(0, m.running + (e.status === "started" ? 1 : -1)),
            score: e.status === "done" && e.score !== undefined ? e.score : m.score,
          }));
          if (e.status === "failed") toast.error("Couldn't mark your explanation", { description: e.error });
          break;
      }
    });
    return () => {
      clearTimeout(fakeTimer);
      unsub();
      s.close();
      voiceRef.current.stop();
    };
  }, [topic.id, navigate]);

  const mic = voice;
  const speaker: BlobSpeaker = mic.listening ? "you" : thinking ? "thinking" : aiSpeaking ? "ai" : "idle";
  const level = mic.listening ? voice.micLevel : aiSpeaking ? voice.speakingLevel : 0;
  // The blob looks worried while it holds wrong ideas, happy once it mostly gets it
  const strong = concepts.filter((c) => c.state === "correct").length;
  const mood: BlobMood = concepts.some((c) => c.state === "very_wrong" || c.state === "slightly_wrong")
    ? "confused"
    : strong >= concepts.length / 2
      ? "happy"
      : "neutral";
  const caption = mic.listening ? mic.interim || "Listening…" : speaker === "you" || thinking ? youLine : aiLine;
  const captionWho = speaker === "you" || thinking ? "You" : "Your student";

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-8 md:px-10 md:py-10">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5 border-b pb-7">
        <div>
          <Eyebrow dot="bg-brand" className="text-muted-foreground">Teaching session</Eyebrow>
          <h1 className="mt-3 text-4xl font-medium leading-none md:text-6xl">{topic.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => { setMuted(!muted); voice.stop(); }} aria-label={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
          <Button size="lg" onClick={() => sessionRef.current?.finish()}>
            <Flag className="h-4 w-4" /> Finish and test
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="relative flex min-h-[620px] flex-col items-center overflow-hidden rounded-[24px] border border-ink bg-ink p-6 text-ink-foreground shadow-card md:p-8">
          <div className="flex w-full items-center justify-between gap-4">
            <Eyebrow dot={MODE_META[mode].dot}>{MODE_META[mode].label}</Eyebrow>
            <span className="text-right text-xs text-ink-foreground/50">{speaker === "you" ? (mic.wrappingUp ? "Paused — finishing your turn…" : "You're talking") : speaker === "ai" ? "Your student is talking" : speaker === "thinking" ? "Thinking…" : "Tap the mic and start teaching"}</span>
          </div>

          {student && (
            <div className="animate-rise mt-5 flex flex-col items-center gap-1.5 text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-ink-foreground/15 px-3.5 py-1.5 text-xs font-semibold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: blobColours(student).main }} />
                Today's student: {student.label}
              </span>
              <span className="text-xs text-ink-foreground/50">{student.blurb}</span>
            </div>
          )}

          <div className="flex flex-1 items-center justify-center">
            <StudentBlob level={level} speaker={speaker} mood={mood} colours={student ? blobColours(student) : undefined} />
          </div>

          <div className="mb-7 min-h-[104px] w-full max-w-xl text-center">
            {caption && (
              <>
                <p className="label-text mb-3 text-ink-foreground/40">{captionWho}</p>
                <p key={caption} className={cn("animate-rise text-xl font-medium leading-snug tracking-[-0.02em]", captionWho === "You" && "text-ink-foreground/60")}>{caption}</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={mic.toggle}
              disabled={!mic.supported}
              aria-label={mic.listening ? "Stop talking" : "Start talking"}
              title={mic.supported ? (voice.engine === "elevenlabs" ? "Voice: ElevenLabs" : "Voice: browser") : voice.engine === "checking" ? "Getting the microphone ready…" : "Speech recognition isn't supported in this browser — try Chrome or Edge"}
              className={cn(
                "relative grid h-20 w-20 place-items-center rounded-full transition-all duration-300 disabled:opacity-40",
                mic.listening ? "scale-110 bg-brand text-brand-foreground" : "bg-card text-card-foreground hover:scale-105",
                mic.wrappingUp && "ring-4 ring-brand/35",
              )}
            >
              {mic.listening && <span className="animate-mic-wave absolute inset-0 rounded-full bg-brand" />}
              {mic.listening ? <MicOff className="relative h-7 w-7" /> : <Mic className="relative h-7 w-7" />}
            </button>
            <Button variant="ghost" size="icon" className="h-12 w-12 text-ink-foreground/60 hover:bg-ink-foreground/10 hover:text-ink-foreground" onClick={() => setTypeOpen(!typeOpen)} aria-label="Type instead">
              <Keyboard className="h-5 w-5" />
            </Button>
          </div>
          {typeOpen && (
            <form className="mt-5 flex w-full max-w-xl gap-2" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type your explanation…"
                className="h-12 flex-1 rounded-full border border-ink-foreground/20 bg-ink-foreground/10 px-5 text-ink-foreground outline-none placeholder:text-ink-foreground/35 focus:border-brand focus:ring-2 focus:ring-brand/25"
              />
              <Button type="submit" size="icon" className="h-12 w-12 bg-brand text-brand-foreground" aria-label="Send"><Send className="h-4 w-4" /></Button>
            </form>
          )}
        </section>

        <section className="surface-panel flex min-h-[620px] flex-col p-6 md:p-8">
          <div className="flex items-center justify-between gap-4 border-b pb-5">
            <h2 className="text-2xl font-medium">Live concept map</h2>
            <div className="flex items-center gap-2">
              {topic.lessonId && (marking.running > 0 || marking.score !== null) && (
                <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground" aria-live="polite">
                  {marking.running > 0 ? "Marking…" : `Score ${Math.round(marking.score ?? 0)}`}
                </span>
              )}
              <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground">{concepts.filter((c) => c.state === "correct").length}/{concepts.length} strong</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 py-2"><ConceptMap title={topic.title} concepts={concepts} /></div>
          <StateLegend className="justify-center border-t pt-5" />
        </section>
      </div>
    </main>
  );
}
