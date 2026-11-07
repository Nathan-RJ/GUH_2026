import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { service, type Topic, type TopicRecord } from "@/services";
import { groupIntoModules } from "@/services/modules";
import { STATE_META } from "@/lib/states";
import { StateLegend } from "@/components/StateLegend";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/Eyebrow";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const Route = createFileRoute("/student/")({
  head: () => ({
    meta: [
      { title: "My progress — Reply 2 Me" },
      { name: "description", content: "Your own progress across your modules, and the topics you can teach next." },
      { property: "og:title", content: "My progress — Reply 2 Me" },
      { property: "og:description", content: "Your progress, topic by topic." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentHome,
});

const COLLAPSED_KEY = "reply2me.collapsedModules";

function StudentHome() {
  // Lessons from the database catalogue, grouped into one section per module (upload title).
  const { data: catalogue, isPending, error, refetch, isFetching } = useQuery({ queryKey: ["student-lessons"], queryFn: () => service.getStudentModule(), staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true, retry: 1 });
  const { data: mine } = useQuery({ queryKey: ["mine"], queryFn: () => service.getMyProgress() });
  const modules = catalogue ? groupIntoModules(catalogue.topics) : undefined;

  // Which module sections are collapsed; remembered in this browser only.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
      if (Array.isArray(saved)) setCollapsed(new Set(saved.filter((x) => typeof x === "string")));
    } catch {
      /* storage unavailable: everything starts open */
    }
  }, []);
  const toggle = (id: string, open: boolean) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (open) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {
        /* not remembered, still works */
      }
      return next;
    });

  const allTopics = catalogue?.topics ?? [];
  const records: TopicRecord[] = allTopics.map((topic) => mine?.[topic.id] ?? { state: "not_covered", score: null, attempts: 0, concepts: Object.fromEntries(topic.concepts.map((c) => [c.id, "not_covered" as const])) });
  const scored = records.filter((r) => r.score !== null);
  const avg = scored.length ? Math.round(scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length) : 0;
  const allConcepts = records.flatMap((r) => Object.values(r.concepts));
  const strong = allConcepts.filter((s) => s === "correct").length;

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-10 md:px-10 md:py-14">
      <div className="border-b pb-10">
        <Eyebrow dot="bg-brand" className="text-muted-foreground">
          {modules ? `${modules.length} ${modules.length === 1 ? "module" : "modules"}` : "Loading modules"}
        </Eyebrow>
        <h1 className="mt-4 text-5xl font-medium leading-none md:text-7xl">My progress</h1>
      </div>

      <div className="mt-8 grid gap-px overflow-hidden rounded-[24px] border border-ink bg-ink-foreground/15 shadow-card sm:grid-cols-3">
        <Stat value={`${avg}`} suffix="/100" label="Average score" />
        <Stat value={`${strong}`} suffix={`/${allConcepts.length}`} label="Concepts taught strongly" />
        <Stat value={`${scored.length}`} suffix={`/${allTopics.length}`} label="Topics attempted" />
      </div>

      <div className="mb-7 mt-16 flex flex-wrap items-end justify-between gap-5">
        <h2 className="text-3xl font-medium md:text-4xl">Choose a topic to teach</h2>
        <div className="flex items-center gap-4"><button type="button" onClick={() => void refetch()} disabled={isFetching} className="text-sm underline">{isFetching ? "Refreshing…" : "Refresh lessons"}</button><StateLegend /></div>
      </div>
      <div aria-live="polite">
        {isPending && <p className="text-muted-foreground">Loading lessons…</p>}
        {error && <p role="alert" className="mb-5 text-destructive">Could not refresh lessons: {error.message}</p>}
        {!isPending && !error && allTopics.length === 0 && <p className="text-muted-foreground">No lessons yet. Ask your teacher to upload module content.</p>}
      </div>

      <div className="space-y-6">
        {modules?.map((module) => {
          const open = !collapsed.has(module.id);
          return (
            <Collapsible key={module.id} open={open} onOpenChange={(o) => toggle(module.id, o)} className="surface-panel overflow-hidden">
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 p-6 text-left transition-colors hover:bg-secondary/50 md:px-7">
                <div className="min-w-0">
                  <h3 className="truncate text-2xl font-medium md:text-3xl">{module.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {module.topics.length} {module.topics.length === 1 ? "topic" : "topics"}
                    {module.code ? ` · ${module.code}` : ""}
                  </p>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary">
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid gap-5 border-t p-6 sm:grid-cols-2 md:p-7 xl:grid-cols-4">
                  {module.topics.map((t, i) => (
                    <TopicCard key={t.id} topic={t} record={mine?.[t.id]} index={i} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </main>
  );
}

function TopicCard({ topic: t, record: rec, index: i }: { topic: Topic; record: TopicRecord | undefined; index: number }) {
  const s = rec?.state ?? "not_covered";
  // After a marked session the record holds the rubric's criteria; before that, the topic's own concepts.
  const recorded = Object.keys(rec?.concepts ?? {});
  const conceptIds = recorded.length ? recorded : t.concepts.map((c) => c.id);
  return (
    <Link
      to="/student/teach/$topicId"
      params={{ topicId: t.id }}
      className="surface-panel animate-rise group flex min-h-[280px] flex-col p-6 transition-all duration-300 hover:-translate-y-1 hover:border-foreground/35 hover:shadow-lift md:p-7"
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
        {conceptIds.length ? (
          conceptIds.map((id) => (
            <span
              key={id}
              title={t.concepts.find((c) => c.id === id)?.label ?? id}
              className={cn("h-1.5 flex-1 rounded-full transition-colors", STATE_META[rec?.concepts[id] ?? "not_covered"].bg)}
            />
          ))
        ) : (
          <span className={cn("h-1.5 flex-1 rounded-full", STATE_META.not_covered.bg)} />
        )}
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-4">
        <span className="text-xs font-medium text-muted-foreground">{rec?.score != null ? `Best ${rec.score}/100` : "Not attempted"}</span>
      </div>
    </Link>
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
