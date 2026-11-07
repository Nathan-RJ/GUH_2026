// Calls to the backend's /api/voice endpoints (see backend/app/voice/).

async function errorFrom(res: Response): Promise<Error> {
  const data = await res.json().catch(() => ({}));
  return new Error(data.error ?? `Voice request failed (${res.status})`);
}

export async function getVoiceStatus(): Promise<{ enabled: boolean }> {
  const res = await fetch("/api/voice/status");
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

/** Recorded audio -> text. */
export async function transcribe(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("audio", audio, `recording.${extensionFor(audio.type)}`);
  const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
  if (!res.ok) throw await errorFrom(res);
  const data: { text: string } = await res.json();
  return data.text;
}

/** Text -> MP3 audio. */
export async function speak(text: string): Promise<Blob> {
  const res = await fetch("/api/voice/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw await errorFrom(res);
  return res.blob();
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4"; // Safari
  if (mimeType.includes("ogg")) return "ogg"; // Firefox (older)
  return "webm"; // Chrome, Edge, Firefox
}
