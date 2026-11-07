import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { service } from "@/services";
import { STATE_META } from "@/lib/states";
import { StateLegend } from "@/components/StateLegend";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/Eyebrow";

export const Route = createFileRoute("/student/")({
  head: () => ({
    meta: [
      { title: "My progress — Reply 2 Me" },
      { name: "description", content: "Your own progress across the module, and the topics you can teach next." },
      { property: "og:title", content: "My progress — Reply 2 Me" },
      { property: "og:description", content: "Your progress, topic by topic." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentHome,
});

function StudentHome() {
  const { data: module } = useQuery({ queryKey: ["module"], queryFn: () => service.getModule() });
  const { data: mine } = useQuery({ queryKey: ["mine"], queryFn: () => service.getMyProgress() });

  const records = mine ? Object.values(mine) : [];
  const scored = records.filter((r) => r.score !== null);
  const avg = scored.length ? Math.round(scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length) : 0;
  const allConcepts = records.flatMap((r) => Object.values(r.concepts));
  const strong = allConcepts.filter((s) => s === "correct").length;

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-10 md:px-10 md:py-14">
      <div className="border-b pb-10">
        <Eyebrow dot="bg-brand" className="text-muted-foreground">{module?.title}</Eyebrow>
        <h1 className="mt-4 text-5xl font-medium leading-none md:text-7xl">My progress</h1>
      </div>

      <div className="mt-8 grid gap-px overflow-hidden rounded-[24px] border border-ink bg-ink-foreground/15 shadow-card sm:grid-cols-3">
        <Stat value={`${avg}`} suffix="/100" label="Average score" />
        <Stat value={`${strong}`} suffix={`/${allConcepts.length}`} label="Concepts taught strongly" />
        <Stat value={`${scored.length}`} suffix={`/${records.length}`} label="Topics attempted" />
      </div>

      <div className="mb-7 mt-16 flex flex-wrap items-end justify-between gap-5">
        <h2 className="text-3xl font-medium md:text-4xl">Choose a topic to teach</h2>
        <StateLegend />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {module?.topics.map((t, i) => {
          const rec = mine?.[t.id];
          const s = rec?.state ?? "not_covered";
          return (
            <Link
              key={t.id}
              to="/student/teach/$topicId"
              params={{ topicId: t.id }}
              className="surface-panel animate-rise group flex min-h-[300px] flex-col p-6 transition-all duration-300 hover:-translate-y-1 hover:border-foreground/35 hover:shadow-lift md:p-7"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-between gap-3">
                <Eyebrow dot={STATE_META[s].bg} className="text-muted-foreground">{STATE_META[s].short}</Eyebrow>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary transition-all group-hover:bg-brand group-hover:text-brand-foreground">
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
              <h3 className="mt-8 text-[28px] font-medium leading-none">{t.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{t.summary}</p>
              <div className="mt-7 flex gap-1.5">
                {t.concepts.map((c) => (
                  <span key={c.id} title={c.label} className={cn("h-1.5 flex-1 rounded-full transition-colors", STATE_META[rec?.concepts[c.id] ?? "not_covered"].bg)} />
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <span className="text-xs font-medium text-muted-foreground">{rec?.score != null ? `Best ${rec.score}/100` : "Not attempted"}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

function Stat({ value, suffix, label }: { value: string; suffix: string; label: string }) {
  return (
    <div className="bg-ink p-7 text-ink-foreground md:p-8">
      <p className="text-5xl font-medium tracking-[-0.05em] md:text-6xl">{value}<span className="text-xl font-normal tracking-normal text-ink-foreground/45">{suffix}</span></p>
      <p className="mt-4 text-sm text-ink-foreground/60">{label}</p>
    </div>
  );
}
