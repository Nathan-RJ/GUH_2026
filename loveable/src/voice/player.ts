// Plays the student's ElevenLabs audio and reports how loud it is each frame,
// so the blob's mouth can move with the real voice.
import { synthesize } from "./api";
import { levelFromTimeDomain } from "./levels";

let ctx: AudioContext | null = null;

/** One shared AudioContext (browsers limit how many you can open). */
export function audioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

const cache = new Map<string, string>(); // voice + text -> object URL, so replays cost no credits

export async function audioUrlFor(text: string, voice?: string): Promise<string> {
  const key = `${voice ?? ""}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const url = URL.createObjectURL(await synthesize(text, voice));
  cache.set(key, url);
  return url;
}

export interface Playback {
  /** Resolves when the audio ends or is stopped; rejects if it can't play. */
  done: Promise<void>;
  stop(): void;
}

export function playWithLevel(url: string, onLevel: (level: number) => void): Playback {
  const el = new Audio(url);
  const ac = audioContext();
  const source = ac.createMediaElementSource(el);
  const analyser = ac.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  analyser.connect(ac.destination);
  const buf = new Uint8Array(analyser.fftSize);

  let raf = 0;
  let finished = false;
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const done = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const cleanup = () => {
    finished = true;
    cancelAnimationFrame(raf);
    onLevel(0);
    source.disconnect();
    analyser.disconnect();
  };
  const finish = () => {
    if (finished) return;
    cleanup();
    resolve();
  };
  const fail = (err: unknown) => {
    if (finished) return;
    cleanup();
    reject(err);
  };

  const tick = () => {
    analyser.getByteTimeDomainData(buf);
    onLevel(levelFromTimeDomain(buf, 3.5));
    raf = requestAnimationFrame(tick);
  };

  el.onended = finish;
  el.onerror = () => fail(new Error("The voice audio couldn't be played."));
  el.play().then(tick, fail);

  return {
    done,
    stop() {
      el.pause();
      finish();
    },
  };
}
