import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PencilLine, RotateCcw, LayoutGrid } from "lucide-react";
import { DEMO_MODULE } from "@/services/demo-data";
import { service, type ConceptState, type ExamResult } from "@/services";
import { ConceptMap } from "@/components/ConceptMap";
import { StateLegend } from "@/components/StateLegend";
import { STATE_META } from "@/lib/states";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/student/results")({
  head: () => ({
    meta: [
      { title: "Exam results — Reply 2 Me" },
      { name: "description", content: "See how well your AI student learned from you, concept by concept." },
      { property: "og:title", content: "Exam results — Reply 2 Me" },
      { property: "og:description", content: "How well did you teach?" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Results,
});

const GROUPS: { title: string; states: ConceptState[] }[] = [
  { title: "What was strong", states: ["correct"] },
  { title: "On the right track, but incomplete", states: ["partial"] },
  { title: "What was wrong", states: ["very_wrong", "slightly_wrong"] },
  { title: "Never covered", states: ["not_covered"] },
];

function Results() {
  const [result, setResult] = useState<ExamResult | null | undefined>(undefined);
  const [phase, setPhase] = useState<"exam" | "done">("exam");
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setResult(service.getLastResult());
    const t = setTimeout(() => setPhase("done"), 2600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== "done" || !result) return;
    let n = 0;
    const id = setInterval(() => {
      n = Math.min(result.score, n + Math.max(1, Math.ceil(result.score / 40)));
      setShown(n);
      if (n >= result.score) clearInterval(id);
    }, 25);
    return () => clearInterval(id);
  }, [phase, result]);

  if (result === null) {
    return (
      <main className="mx-auto grid min-h-[calc(100vh-80px)] max-w-xl place-items-center px-6 py-24 text-center">
        <div>
          <h1 className="text-4xl font-medium">No exam to show yet</h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">Teach a topic first, then press "Finish and test".</p>
          <Button asChild className="mt-7"><Link to="/student">Choose a topic</Link></Button>
        </div>
      </main>
    );
  }
  if (!result) return null;
  const topic = DEMO_MODULE.topics.find((t) => t.id === result.topicId)!;

  if (phase === "exam") {
    return (
      <main className="grid min-h-[calc(100vh-80px)] place-items-center px-6 py-16">
        <div className="text-center">
          <div className="relative mx-auto h-52 w-44 rotate-2 rounded-[24px] border bg-card p-6 shadow-lift">
            <div className="mb-6 h-1.5 w-10 rounded-full bg-brand" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="mb-3 h-1.5 animate-pulse rounded-full bg-muted" style={{ width: `${60 + ((i * 17) % 35)}%`, animationDelay: `${i * 150}ms` }} />
            ))}
            <span className="absolute bottom-7 left-9 grid h-12 w-12 place-items-center rounded-full bg-ink"><PencilLine className="animate-write h-6 w-6 text-brand" /></span>
          </div>
          <h1 className="mt-10 text-3xl font-medium md:text-4xl">Your student is sitting the exam…</h1>
          <p className="mt-3 text-muted-foreground">Answers are being marked against your teacher's rubric.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-10 md:px-10 md:py-14">
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="animate-rise flex flex-col items-center justify-center rounded-[24px] border border-ink bg-ink p-8 text-center text-ink-foreground shadow-card md:p-10">
          <p className="label-text text-brand">{topic.title} · Exam score</p>
          <div className="relative mt-7 h-56 w-56">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--ink-foreground)" strokeOpacity="0.12" strokeWidth="7" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--brand)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(shown / 100) * 326.7} 326.7`} />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div><span className="font-display text-7xl font-medium tracking-[-0.06em]">{shown}</span><span className="text-lg text-ink-foreground/40">/100</span></div>
            </div>
          </div>
          <p className="mt-7 max-w-xs leading-relaxed text-ink-foreground/60">
            {result.score >= 85 ? "Brilliant teaching — your student aced it." : result.score >= 55 ? "Solid start. A few gaps left your student guessing." : "Your student is still confused. Have another go!"}
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-brand text-brand-foreground hover:bg-brand/90"><Link to="/student/teach/$topicId" params={{ topicId: topic.id }}><RotateCcw className="h-4 w-4" /> Try again</Link></Button>
            <Button asChild size="lg" variant="outline" className="border-ink-foreground/20 bg-transparent text-ink-foreground hover:border-ink-foreground/40 hover:bg-ink-foreground/10 hover:text-ink-foreground"><Link to="/student"><LayoutGrid className="h-4 w-4" /> Topics</Link></Button>
          </div>
        </section>
        <section className="surface-panel animate-rise flex flex-col p-6 md:p-8" style={{ animationDelay: "120ms" }}>
          <h2 className="border-b pb-5 text-2xl font-medium">Final concept map</h2>
          <div className="h-[420px]"><ConceptMap title={topic.title} concepts={result.concepts} /></div>
          <StateLegend className="justify-center border-t pt-5" />
        </section>
      </div>

      <div className="mb-7 mt-16 border-b pb-7">
        <h2 className="text-4xl font-medium">Feedback</h2>
        <p className="mt-2 text-sm text-muted-foreground">Based on topics and concepts only — exam questions stay private.</p>
      </div>
      <div className="grid items-start gap-5 md:grid-cols-2">
        {GROUPS.map((g, gi) => {
          const items = result.concepts.filter((c) => g.states.includes(c.state));
          return (
            <div key={g.title} className="surface-panel animate-rise p-6 md:p-7" style={{ animationDelay: `${200 + gi * 80}ms` }}>
              <h3 className="mb-5 flex items-center gap-2.5 border-b pb-5 text-xl font-medium">
                <span className={cn("h-2.5 w-2.5 rounded-full", STATE_META[g.states[0]!].bg)} /> {g.title}
                <span className="ml-auto grid h-7 min-w-7 place-items-center rounded-full bg-secondary px-2 text-xs font-semibold text-muted-foreground">{items.length}</span>
              </h3>
              {items.length ? (
                <ul className="space-y-3">
                  {items.map((c) => (
                    <li key={c.id} className="rounded-2xl bg-secondary p-4">
                      <p className="flex items-center gap-2.5 font-semibold"><span className={cn("h-2 w-2 rounded-full", STATE_META[c.state].bg)} />{c.label}</p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.note}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing here.</p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
