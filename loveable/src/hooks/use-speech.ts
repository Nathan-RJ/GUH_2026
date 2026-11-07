import { useCallback, useEffect, useRef, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = any;

/** How long a pause counts as "finished talking". */
export const SPEECH_SILENCE_MS = 2200;
/** Show the "finishing up" cue this long before the turn actually ends. */
export const SPEECH_WARN_MS = 900;

export interface SilenceWatcher {
  /** Restart the countdown (call on every new piece of speech). */
  arm: () => void;
  /** Stop the countdown. */
  cancel: () => void;
}

/**
 * Watches for a long pause in speech: `onWarn(true)` shortly before the turn
 * closes, then `onDone()` once the pause runs the full length.
 */
export function createSilenceWatcher({
  silenceMs = SPEECH_SILENCE_MS,
  warnMs = SPEECH_WARN_MS,
  onWarn,
  onDone,
}: {
  silenceMs?: number;
  warnMs?: number;
  onWarn: (active: boolean) => void;
  onDone: () => void;
}): SilenceWatcher {
  let warnT: ReturnType<typeof setTimeout> | null = null;
  let doneT: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (warnT) clearTimeout(warnT);
    if (doneT) clearTimeout(doneT);
    warnT = null;
    doneT = null;
    onWarn(false);
  };

  const arm = () => {
    cancel();
    warnT = setTimeout(() => {
      warnT = null;
      onWarn(true);
    }, Math.max(0, silenceMs - warnMs));
    doneT = setTimeout(() => {
      doneT = null;
      onWarn(false);
      onDone();
    }, silenceMs);
  };

  return { arm, cancel };
}

export function useSpeechRecognition(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [wrappingUp, setWrappingUp] = useState(false);
  const recRef = useRef<AnyRec>(null);
  const finalRef = useRef("");
  const silenceRef = useRef<SilenceWatcher | null>(null);
  const cbRef = useRef(onFinal);
  cbRef.current = onFinal;

  useEffect(() => {
    const w = window as AnyRec;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const rec = new SR();
    rec.lang = "en-GB";
    rec.continuous = true;
    rec.interimResults = true;
    const silence = createSilenceWatcher({ onWarn: setWrappingUp, onDone: () => rec.stop() });
    silenceRef.current = silence;
    let lastText = "";
    rec.onresult = (e: AnyRec) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      finalRef.current = text;
      setInterim(text);
      // Only a genuine pause (no new words) runs the clock down.
      if (text !== lastText) {
        lastText = text;
        if (text.trim()) silence.arm();
      }
    };
    rec.onend = () => {
      silence.cancel();
      setListening(false);
      const t = finalRef.current.trim();
      finalRef.current = "";
      lastText = "";
      setInterim("");
      if (t) cbRef.current(t);
    };
    rec.onerror = () => {
      silence.cancel();
      setListening(false);
    };
    recRef.current = rec;
    return () => {
      silence.cancel();
      rec.abort();
    };
  }, []);

  const toggle = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      silenceRef.current?.cancel();
      rec.stop();
    } else {
      finalRef.current = "";
      setInterim("");
      rec.start();
      setListening(true);
    }
  }, [listening]);

  return { supported, listening, interim, wrappingUp, toggle };
}

// Pick a younger, lighter-sounding English voice where the browser offers one.
function pickStudentVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  const prefer = [/google uk english female/i, /libby|maisie|sonia|amy|emma/i, /samantha|karen|tessa|moira/i, /female/i];
  for (const re of prefer) {
    const v = voices.find((x) => re.test(x.name));
    if (v) return v;
  }
  return voices.find((v) => v.lang === "en-GB") ?? voices[0];
}

export interface SpeakHandlers {
  onStart?: () => void;
  onBoundary?: () => void;
  onEnd?: () => void;
}

export function speak(text: string, h: SpeakHandlers = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    h.onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB";
  u.rate = 1.12; // quick, slightly eager delivery
  u.pitch = 1.45; // higher, younger tone
  const v = pickStudentVoice();
  if (v) u.voice = v;
  u.onstart = () => h.onStart?.();
  u.onboundary = () => h.onBoundary?.();
  u.onend = () => h.onEnd?.();
  u.onerror = () => h.onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Live microphone loudness (0–1) while `active`. */
export function useMicLevel(active: boolean) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!active || !navigator.mediaDevices?.getUserMedia) return;
    let raf = 0;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        ctx = new AudioContext();
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        ctx.createMediaStreamSource(s).connect(an);
        const buf = new Uint8Array(an.fftSize);
        const tick = () => {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (const b of buf) sum += ((b - 128) / 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
      setLevel(0);
    };
  }, [active]);
  return level;
}
