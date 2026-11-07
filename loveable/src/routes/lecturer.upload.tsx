import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { BookOpen, CheckCircle2, FileText, Loader2, Lock, ScrollText, UploadCloud, ArrowRight } from "lucide-react";
import { service, type DocKind, type UploadedDoc } from "@/services";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lecturer/upload")({
  head: () => ({
    meta: [
      { title: "Upload module documents — Reply 2 Me" },
      { name: "description", content: "Upload module content, past exam papers and your marking rubric." },
      { property: "og:title", content: "Upload module documents — Reply 2 Me" },
      { property: "og:description", content: "Turn your module documents into teachable topics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadPage,
});

const ZONES: { kind: DocKind; title: string; hint: string; icon: typeof BookOpen; secret?: boolean }[] = [
  { kind: "content", title: "Module content", hint: "Slides, lecture notes", icon: BookOpen },
  { kind: "exams", title: "Past exam papers", hint: "Previous years' papers", icon: ScrollText, secret: true },
  { kind: "rubric", title: "Marking rubric", hint: "Criteria and mark schemes", icon: FileText, secret: true },
];
const ACCEPT = ".pdf,.pptx,.docx,.txt";

type Item = UploadedDoc & { status: "processing" | "ready" };

function UploadPage() {
  const [items, setItems] = useState<Item[]>([]);
  const { data: module } = useQuery({ queryKey: ["module"], queryFn: () => service.getModule() });

  const add = (files: File[], kind: DocKind) => {
    const valid = files.filter((f) => /\.(pdf|pptx|docx|txt)$/i.test(f.name));
    valid.forEach((f) => {
      const doc: Item = { id: `${f.name}-${Date.now()}-${Math.random()}`, name: f.name, kind, size: f.size, status: "processing" };
      setItems((x) => [...x, doc]);
      service.processDocument(doc).then(() => setItems((x) => x.map((i) => (i.id === doc.id ? { ...i, status: "ready" } : i))));
    });
  };

  const loadSample = () => {
    const sample: [string, DocKind][] = [
      ["Week 6 – Recursion.pptx", "content"],
      ["CS101 Lecture Notes.pdf", "content"],
      ["CS101 Exam 2024.pdf", "exams"],
      ["CS101 Marking Rubric.docx", "rubric"],
    ];
    sample.forEach(([n, k]) => add([new File(["demo"], n)], k));
  };

  const contentReady = items.some((i) => i.kind === "content" && i.status === "ready");

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-10 md:px-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b pb-10">
        <div className="max-w-3xl">
          <p className="label-text text-muted-foreground">{module?.code ?? "CS101"} · Teacher</p>
          <h1 className="mt-4 text-4xl font-medium leading-[1.02] md:text-6xl">{module?.title ?? "Introduction to Programming"}</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">Drop your documents in. We'll turn them into topics your students can teach.</p>
        </div>
        <Button variant="outline" onClick={loadSample}>Load sample documents</Button>
      </div>

      <div className="mb-8 flex items-center gap-4 rounded-2xl bg-ink px-5 py-4 text-ink-foreground md:px-6">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground"><Lock className="h-4 w-4" /></span>
        <p className="text-sm font-medium md:text-base">Exam papers and rubric are never shown to students.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {ZONES.map((z) => (
          <DropZone key={z.kind} zone={z} items={items.filter((i) => i.kind === z.kind)} onFiles={(f) => add(f, z.kind)} />
        ))}
      </div>

      {contentReady && module && (
        <section className="animate-rise mt-16 border-t pt-10">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-medium md:text-4xl">Generated topics</h2>
              <p className="mt-2 text-muted-foreground">{module.topics.length} topics extracted from your module content.</p>
            </div>
            <Button asChild>
              <Link to="/lecturer/dashboard">View dashboard <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {module.topics.map((t, i) => (
              <div key={t.id} className="surface-panel animate-rise p-6 md:p-7" style={{ animationDelay: `${i * 90}ms` }}>
                <h3 className="text-2xl font-medium">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.summary}</p>
                <div className="mt-6 flex flex-wrap gap-2 border-t pt-5">
                  {t.concepts.map((c) => (
                    <span key={c.id} className="rounded-full border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">{c.label}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function DropZone({ zone, items, onFiles }: { zone: (typeof ZONES)[number]; items: Item[]; onFiles: (f: File[]) => void }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const Icon = zone.icon;
  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(Array.from(e.dataTransfer.files)); }}
        onClick={() => input.current?.click()}
        className={cn(
          "group flex min-h-[320px] w-full cursor-pointer flex-col items-start rounded-[24px] border border-dashed bg-card p-7 text-left shadow-card transition-all duration-300",
          over ? "-translate-y-1 border-brand bg-primary-soft" : "hover:-translate-y-1 hover:border-foreground/45 hover:shadow-lift",
        )}
      >
        <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        <div className="mb-10 grid h-12 w-12 place-items-center rounded-full bg-secondary text-foreground transition-colors group-hover:bg-brand group-hover:text-brand-foreground"><Icon className="h-5 w-5" /></div>
        <h3 className="text-2xl font-medium">{zone.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{zone.hint}</p>
        <p className="mt-7 inline-flex items-center gap-2 text-sm font-semibold"><UploadCloud className="h-4 w-4" /> Drag files or click to browse</p>
        <p className="mt-1 text-xs text-muted-foreground">PDF, PPTX, DOCX or TXT</p>
        {zone.secret && <p className="mt-auto inline-flex items-center gap-1.5 pt-5 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Hidden from students</p>}
      </div>
      {items.map((i) => (
        <div key={i.id} className="animate-rise relative overflow-hidden rounded-2xl border bg-card p-4 shadow-card">
          {i.status === "processing" && <div className="animate-shimmer absolute inset-0" />}
          <div className="relative flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary"><FileText className="h-4 w-4 text-muted-foreground" /></span>
            <span className="flex-1 truncate text-sm font-medium">{i.name}</span>
            {i.status === "processing" ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-state-correct"><CheckCircle2 className="h-4 w-4" /> Ready</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
