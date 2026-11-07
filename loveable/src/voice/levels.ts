/** Loudness (0–1) from an AnalyserNode's time-domain bytes. Same scale as useMicLevel. */
export function levelFromTimeDomain(buf: Uint8Array, gain = 4): number {
  if (buf.length === 0) return 0;
  let sum = 0;
  for (const b of buf) sum += ((b - 128) / 128) ** 2;
  return Math.min(1, Math.sqrt(sum / buf.length) * gain);
}

/** Above this mic level counts as talking (for the "you've stopped talking" timer). */
export const SPEECH_LEVEL = 0.12;
