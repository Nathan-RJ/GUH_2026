// Every call to the backend goes through this file.
import type { Session } from "./types";

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export async function createSession(prompt: string, files: File[]): Promise<Session> {
  const form = new FormData();
  form.append("prompt", prompt);
  files.forEach((file) => form.append("files", file));
  return handle(await fetch("/api/sessions", { method: "POST", body: form }));
}

export async function getSession(id: string): Promise<Session> {
  return handle(await fetch(`/api/sessions/${id}`));
}

export async function sendMessage(id: string, text: string): Promise<Session> {
  return handle(
    await fetch(`/api/sessions/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }),
  );
}

export function attachmentUrl(sessionId: string, name: string): string {
  return `/api/sessions/${sessionId}/attachments/${encodeURIComponent(name)}`;
}
