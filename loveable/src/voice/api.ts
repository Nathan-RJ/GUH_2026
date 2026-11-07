// Calls to the Flask backend's ElevenLabs routes (backend/app/voice/).
// In local dev, /api is proxied to Flask (vite.config.ts). Elsewhere set VITE_API_URL.

const BASE = ((import.meta.env["VITE_API_URL"] as string | undefined) ?? "").replace(/\/$/, "");

async function errorFrom(res: Response): Promise<Error> {
  const data = await res.json().catch(() => ({}));
  return new Error(data?.error ?? `Voice request failed (${res.status})`);
}

/**
 * Is ElevenLabs voice ready? False if the backend is unreachable (e.g. inside
 * Lovable's preview), has no API key, or answers with something that isn't JSON.
 */
export async function voiceAvailable(timeoutMs = 2500): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/api/voice/status`, { signal: ctrl.signal });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return data?.enabled === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Recorded audio -> text. */
export async function transcribe(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("audio", audio, `recording.${extensionFor(audio.type)}`);
  const res = await fetch(`${BASE}/api/voice/transcribe`, { method: "POST", body: form });
  if (!res.ok) throw await errorFrom(res);
  const data: { text?: string } = await res.json();
  return (data.text ?? "").trim();
}

/** Text -> MP3 audio. */
export async function synthesize(text: string): Promise<Blob> {
  const res = await fetch(`${BASE}/api/voice/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw await errorFrom(res);
  return res.blob();
}

export function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4"; // Safari
  if (mimeType.includes("ogg")) return "ogg";
  return "webm"; // Chrome, Edge, Firefox
}
