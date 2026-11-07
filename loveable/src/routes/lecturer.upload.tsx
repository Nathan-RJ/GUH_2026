import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, FileText, Loader2, Lock, ScrollText, UploadCloud } from "lucide-react";
import { service, type DocKind, type DocumentResult } from "@/services";
import { DOCUMENT_ACCEPT, validateDocument } from "@/services/upload";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lecturer/upload")({
  head: () => ({ meta: [{ title: "Upload module content - Reply 2 Me" }] }),
  component: UploadPage,
});

const ZONES = [
  { kind: "content", title: "Module content", icon: BookOpen },
  { kind: "exams", title: "Past exam papers", icon: ScrollText },
  { kind: "rubric", title: "Marking rubric", icon: FileText },
] as const;

type Item = { id: string; name: string; state: "uploading" | "processing" | "draft" | "unconfirmed" | "error"; message?: string; result?: DocumentResult };

export function UploadPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const busy = items.some((item) => item.state === "uploading" || item.state === "processing");

  const select = (files: File[]) => {
    if (busy) return;
    if (files.length !== 1) { setError("Choose exactly one document at a time."); setFile(null); return; }
    const chosen = files[0]!;
    const suggested = chosen.name.replace(/\.[^.]+$/, "").slice(0, 200);
    const issue = validateDocument({ file: chosen, title: suggested, kind: "content" });
    setError(issue);
    setFile(issue ? null : chosen);
    if (!issue) setTitle(suggested);
  };

  const upload = async () => {
    if (!file || busy) return;
    const doc = { file, title, kind: "content" as DocKind };
    const issue = validateDocument(doc);
    if (issue) { setError(issue); return; }
    setError(null);
    const id = crypto.randomUUID();
    const update = (patch: Partial<Item>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    setItems((current) => [...current, { id, name: file.name, state: "uploading" }]);
    try {
      const result = await service.processDocument(doc, () => update({ state: "processing" }));
      update({ state: result.status, result });
      if (result.status === "draft") void queryClient.invalidateQueries({ queryKey: ["student-lessons"] });
      setFile(null);
      setTitle("");
    } catch (cause) {
      update({ state: "error", message: cause instanceof Error ? cause.message : "Upload failed. Check n8n executions before retrying." });
    }
  };

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-10 md:px-10 md:py-14">
      <div className="mb-8 border-b pb-10">
        <p className="label-text text-muted-foreground">Teacher</p>
        <h1 className="mt-4 text-4xl font-medium md:text-6xl">Upload module content</h1>
        <p className="mt-5 text-muted-foreground">Upload one PDF, TXT or MD document, up to 10 MB. Your document will be turned into a lesson.</p>
      </div>
      <div className="mb-8 flex items-center gap-4 rounded-2xl bg-ink px-5 py-4 text-ink-foreground">
        <Lock className="h-5 w-5 shrink-0" />
        <p>Exam and rubric uploads are disabled until separate private handling is available. Do not upload them as module content.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {ZONES.map((zone) => <DropZone key={zone.kind} zone={zone} disabled={zone.kind !== "content" || busy} onFiles={select} />)}
      </div>
      {file && <div className="surface-panel mt-6 space-y-4 p-6">
        <p className="break-all">Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
        <label className="block font-medium" htmlFor="lesson-title">Lesson title</label>
        <input id="lesson-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} disabled={busy} className="w-full rounded-lg border bg-background p-3" />
        <Button onClick={upload} disabled={busy || !title.trim()}>{busy ? "Please wait…" : "Upload and prepare lesson"}</Button>
      </div>}
      {error && <p role="alert" className="mt-4 text-destructive">{error}</p>}
      <div aria-live="polite" className="mt-8 space-y-4">
        {items.map((item) => <div key={item.id} className="surface-panel p-6">
          <h2 className="break-all font-medium">{item.name}</h2>
          {(item.state === "uploading" || item.state === "processing") && <p className="mt-2 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{item.state === "uploading" ? "Uploading document…" : "Document sent. Waiting for n8n to generate and save the lesson…"}</p>}
          {item.result?.status === "draft" && <><p className="mt-2 text-state-correct">Lesson uploaded successfully.</p><p className="mt-2 break-all text-sm">Lesson ID: {item.result.lesson_id}</p><p className="mt-2 text-sm text-muted-foreground">Open the student page to find your lesson.</p></>}
          {item.result?.status === "unconfirmed" && <p className="mt-2">Completion unconfirmed: {item.result.message}</p>}
          {item.state === "error" && <p role="alert" className="mt-2 text-destructive">{item.message}</p>}
        </div>)}
      </div>
    </main>
  );
}

function DropZone({ zone, disabled, onFiles }: { zone: (typeof ZONES)[number]; disabled: boolean; onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const Icon = zone.icon;
  return <div
    onDragOver={(event) => { event.preventDefault(); if (!disabled) setOver(true); }}
    onDragLeave={() => setOver(false)}
    onDrop={(event) => { event.preventDefault(); setOver(false); if (!disabled) onFiles(Array.from(event.dataTransfer.files)); }}
    className={cn("flex min-h-[280px] flex-col items-start rounded-[24px] border border-dashed bg-card p-7 shadow-card", disabled && "opacity-60", over && "border-brand bg-primary-soft")}
  >
    <Icon className="mb-8 h-6 w-6" />
    <h2 className="text-2xl font-medium">{zone.title}</h2>
    {zone.kind === "content" ? <>
      <p className="mt-2 text-sm text-muted-foreground">PDF, TXT or MD · Maximum 10 MB · One file per upload</p>
      <input ref={input} type="file" accept={DOCUMENT_ACCEPT} disabled={disabled} className="hidden" aria-label="Module content document" onChange={(event) => { if (event.target.files?.length) onFiles(Array.from(event.target.files)); event.target.value = ""; }} />
      <Button variant="outline" disabled={disabled} className="mt-6" onClick={() => input.current?.click()}><UploadCloud className="h-4 w-4" />Choose document</Button>
      <p className="mt-2 text-xs text-muted-foreground">Or drop a file here</p>
    </> : <><p className="mt-4 text-sm">Unavailable: separate private handling is not implemented.</p><Button disabled variant="outline" className="mt-6"><Lock className="h-4 w-4" />Uploads disabled</Button></>}
  </div>;
}
