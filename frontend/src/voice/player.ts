// One shared audio player, so only one message plays at a time.
// Components subscribe to know which text is currently playing.
import { speak } from "./voiceApi";

type Listener = (playingText: string | null) => void;

let audio: HTMLAudioElement | null = null;
let current: string | null = null;
const listeners = new Set<Listener>();
const cache = new Map<string, string>(); // text -> object URL (replays cost nothing)

function setCurrent(text: string | null) {
  current = text;
  listeners.forEach((listener) => listener(text));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentlyPlaying(): string | null {
  return current;
}

export function stop() {
  if (audio) {
    audio.pause();
    audio = null;
  }
  setCurrent(null);
}

/** Read `text` out loud. Stops anything already playing. */
export async function play(text: string): Promise<void> {
  stop();
  setCurrent(text); // counts as "playing" while the audio loads
  try {
    let url = cache.get(text);
    if (!url) {
      url = URL.createObjectURL(await speak(text));
      cache.set(text, url);
    }
    if (current !== text) return; // stopped or replaced while loading

    const el = new Audio(url);
    audio = el;
    el.onended = () => {
      if (audio === el) {
        audio = null;
        setCurrent(null);
      }
    };
    await el.play();
  } catch (err) {
    if (current === text) setCurrent(null);
    throw err;
  }
}
