import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronDown, Lightbulb, Users } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import type { Module, StudentOverview, Topic } from "@/services";
import { service } from "@/services";
import { STATE_META, STATE_ORDER } from "@/lib/states";
import { StateLegend } from "@/components/StateLegend";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lecturer/dashboard")({
  head: () => ({
    meta: [
      { title: "Cohort dashboard — Reply 2 Me" },
      { name: "description", content: "See how your cohort taught each topic, common misconceptions and flagged sessions." },
      { property: "og:title", content: "Cohort dashboard — Reply 2 Me" },
      { property: "og:description", content: "Cohort understanding at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const SELECTED_KEY = "reply2me.dashboardModule";

function Dashboard() {
  const qc = useQueryClient();
  const { data: modules } = useQuery({ queryKey: ["modules"], queryFn: () => service.getModules() });
  const { data: cohort } = useQuery({ queryKey: ["cohort"], queryFn: () => service.getCohort() });
  const { data: mis } = useQuery({ queryKey: ["mis"], queryFn: () => service.getMisconceptions() });
  const { data: esc } = useQuery({ queryKey: ["esc"], queryFn: () => service.getEscalations() });
  const { data: students } = useQuery({ queryKey: ["students"], queryFn: () => service.getStudents() });

  const review = async (id: string) => {
    await service.markReviewed(id);
    qc.invalidateQueries({ queryKey: ["esc"] });
  };

  // One module at a time, so topics from different modules never mix. Remembered in this browser.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    try {
      setSelectedId(localStorage.getItem(SELECTED_KEY));
    } catch {
      /* storage unavailable: start on the first module */
    }
  }, []);
  const select = (id: string) => {
    setSelectedId(id);
    try {
      localStorage.setItem(SELECTED_KEY, id);
    } catch {
      /* not remembered, still works */
    }
  };
  const module: Module | undefined = modules?.find((m) => m.id === selectedId) ?? modules?.[0];
  const topicIds = new Set(module?.topics.map((t) => t.id) ?? []);
  const topicTitles = new Set(module?.topics.map((t) => t.title) ?? []);
  const moduleMis = mis?.filter((m) => topicTitles.has(m.topicTitle));
  const moduleEsc = esc?.filter((e) => topicIds.has(e.topicId));

  // Students in this module's cohort: the largest per-topic headcount.
  const total = Math.max(0, ...(module?.topics ?? []).map((t) => Object.values(cohort?.[t.id] ?? {}).reduce((a, b) => a + b, 0)));

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-10 md:px-10 md:py-14">
      <div className="mb-9 flex flex-wrap items-end justify-between gap-6 border-b pb-10">
        <div>
          <p className="label-text text-muted-foreground">{module?.code ? `${module.code} · ` : ""}Teacher</p>
          <h1 className="mt-4 text-5xl font-medium leading-none md:text-7xl">Cohort overview</h1>
        </div>
        <span className="inline-flex items-center gap-2.5 rounded-full bg-ink px-5 py-3 text-sm font-medium text-ink-foreground"><Users className="h-4 w-4 text-brand" /> {total} students</span>
      </div>

      {modules && modules.length > 0 && (
        <div className="mb-8">
          <p id="module-picker-label" className="label-text mb-3 text-muted-foreground">Module</p>
          <div role="radiogroup" aria-labelledby="module-picker-label" className="flex flex-wrap gap-2">
            {modules.map((m) => {
              const active = m.id === module?.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => select(m.id)}
                  className={cn(
                    "rounded-full border px-5 py-2.5 text-sm font-medium transition-colors",
                    active ? "border-ink bg-ink text-ink-foreground" : "bg-background text-muted-foreground hover:border-foreground/35 hover:text-foreground",
                  )}
                >
                  {m.title}
                  <span className={cn("ml-2 text-xs", active ? "text-ink-foreground/60" : "text-muted-foreground/70")}>{m.topics.length}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid min-w-0 gap-5 lg:grid-cols-12">
        <section className="surface-panel min-w-0 p-6 md:p-8 lg:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h2 className="text-2xl font-medium">Understanding by topic{module ? <span className="text-muted-foreground"> · {module.title}</span> : null}</h2>
            <StateLegend className="mb-7 w-full min-w-0 max-w-md justify-start sm:w-auto lg:justify-end" />
          </div>
          <div className="mt-7 divide-y border-y">
            {module?.topics.map((t, ti) => {
              const c = cohort?.[t.id];
              const sum = c ? Object.values(c).reduce((a, b) => a + b, 0) : 0;
              if (!c || !sum) {
                return (
                  <div key={t.id} className="flex items-baseline justify-between gap-4 py-5 text-sm first:pt-1 last:pb-1">
                    <span className="text-base font-semibold">{t.title}</span>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">No sessions yet</span>
                  </div>
                );
              }
              return (
                <div key={t.id} className="py-5 first:pt-1 last:pb-1">
                  <div className="mb-3 flex items-baseline justify-between gap-4 text-sm">
                    <span className="text-base font-semibold">{t.title}</span>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">{Math.round((c.correct / sum) * 100)}% strong</span>
                  </div>
                  <div className="flex h-7 gap-[3px] overflow-hidden rounded-full bg-muted p-[3px]">
                    {STATE_ORDER.map((s, i) => (
                      <div
                        key={s}
                        title={`${STATE_META[s].label}: ${c[s]} students`}
                        className={cn("animate-rise flex items-center justify-center rounded-full text-[10px] font-semibold text-foreground/75 transition-all first:rounded-l-full last:rounded-r-full", STATE_META[s].bg)}
                        style={{ width: `${(c[s] / sum) * 100}%`, animationDelay: `${ti * 80 + i * 40}ms` }}
                      >
                        {c[s] / sum > 0.08 ? c[s] : ""}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="surface-panel min-w-0 bg-ink p-6 text-ink-foreground md:p-8 lg:col-span-4">
          <h2 className="mb-6 flex items-center gap-2.5 text-2xl font-medium"><Lightbulb className="h-5 w-5 text-brand" /> Most common misconceptions</h2>
          {moduleMis?.length === 0 && <p className="text-sm text-ink-foreground/60">None recorded for this module yet.</p>}
          <ul className="divide-y divide-ink-foreground/15">
            {moduleMis?.map((m) => (
              <li key={m.text} className="py-5 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-5xl font-medium tracking-[-0.05em] text-brand">{m.percent}%</span>
                  <span className="label-text text-right text-ink-foreground/45">{m.topicTitle}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-foreground/70">of students {m.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {module && students && <Roster topics={module.topics} students={students} />}

        <section className="surface-panel min-w-0 p-6 md:p-8 lg:col-span-12">
          <h2 className="mb-6 flex items-center gap-2.5 text-2xl font-medium"><AlertTriangle className="h-5 w-5 text-destructive" /> Escalations</h2>
          {moduleEsc?.length === 0 && <p className="text-sm text-muted-foreground">No flagged sessions in this module.</p>}
          <div className="grid gap-4 md:grid-cols-2">
            {moduleEsc?.map((e) => (
              <div key={e.id} className={cn("flex flex-col items-start justify-between gap-4 rounded-2xl border bg-background p-5 transition-all sm:flex-row", e.reviewed && "opacity-50")}>
                <div>
                  <p className="text-lg font-semibold">{e.student}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{e.topicTitle} · {e.at}</p>
                  <p className="mt-3 text-sm font-medium text-destructive">{e.reason}</p>
                </div>
                {e.reviewed ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-state-correct"><Check className="h-4 w-4" /> Reviewed</span>
                ) : (
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => review(e.id)}>Mark as reviewed</Button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Roster({ topics, students }: { topics: Topic[]; students: StudentOverview[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="surface-panel min-w-0 p-6 md:p-8 lg:col-span-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium">Student overviews</h2>
          <p className="mt-2 text-sm text-muted-foreground">Best result per topic. Select a student to see every concept.</p>
        </div>
        <StateLegend />
      </div>
      <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-secondary">
            <tr className="text-left label-text text-muted-foreground">
              <th className="px-5 py-4 font-medium">Student</th>
              {topics.map((t) => <th key={t.id} className="px-3 py-4 font-medium">{t.title}</th>)}
              <th className="px-3 py-4 text-right font-medium">Average</th>
              <th className="px-3 py-4 font-medium">Last active</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {students.map((st) => {
              const scores = topics.map((t) => st.topics[t.id]?.score).filter((x): x is number => x != null);
              const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
              const isOpen = open === st.id;
              return (
                <Fragment key={st.id}>
                  <tr onClick={() => setOpen(isOpen ? null : st.id)} className={cn("cursor-pointer border-t transition-colors hover:bg-secondary/70", isOpen && "bg-secondary/70")}>
                    <td className="px-5 py-4 font-semibold">{st.name}</td>
                    {topics.map((t) => {
                      const r = st.topics[t.id];
                      return (
                        <td key={t.id} className="px-3 py-4">
                          <span className="inline-flex items-center gap-2">
                            <span className={cn("h-2.5 w-2.5 rounded-full", STATE_META[r?.state ?? "not_covered"].bg)} />
                            <span className="text-muted-foreground">{r?.score ?? "—"}</span>
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-4 text-right font-semibold">{avg ?? "—"}</td>
                    <td className="px-3 py-4 text-xs text-muted-foreground">{st.lastActive}</td>
                    <td className="px-3 py-4"><ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} /></td>
                  </tr>
                  {isOpen && (
                    <tr key={`${st.id}-d`} className="border-t bg-secondary/50">
                      <td colSpan={topics.length + 4} className="p-5">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          {topics.map((t) => {
                            const r = st.topics[t.id] ?? { state: "not_covered" as const, score: null, attempts: 0, concepts: {} };
                            return (
                              <div key={t.id} className="animate-rise rounded-2xl border bg-card p-5">
                                <div className="mb-4 flex items-center justify-between gap-3 border-b pb-3">
                                  <span className="font-semibold">{t.title}</span>
                                  <span className="text-xs text-muted-foreground">{r.attempts} attempt{r.attempts === 1 ? "" : "s"}</span>
                                </div>
                                <ul className="space-y-2.5">
                                  {t.concepts.map((c) => (
                                    <li key={c.id} className="flex items-center gap-2.5">
                                      <span className={cn("h-2 w-2 shrink-0 rounded-full", STATE_META[r.concepts[c.id] ?? "not_covered"].bg)} />
                                      <span className="flex-1 text-xs">{c.label}</span>
                                      <span className="text-[11px] text-muted-foreground">{STATE_META[r.concepts[c.id] ?? "not_covered"].short}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
