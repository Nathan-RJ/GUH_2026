// One hook for all of the student's voice: listening to you and talking back.
//
// Uses ElevenLabs (through the Flask backend) when it's available. If it isn't
// (backend not running, no API key, or inside Lovable's preview), it falls back
// to the browser's built-in speech so the page always works.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  speak as browserSpeak,
  stopSpeaking as browserStop,
  useMicLevel,
  useSpeechRecognition,
} from "@/hooks/use-speech";
import { voiceAvailable } from "./api";
import { audioUrlFor, playWithLevel, type Playback } from "./player";
import { useElevenLabsMic } from "./use-elevenlabs-mic";

export type VoiceEngine = "checking" | "elevenlabs" | "browser";

interface Options {
  /** Called with what you said once your turn ends. */
  onFinal: (text: string) => void;
  /** Called with a readable message when something goes wrong. */
  onError?: (message: string) => void;
}

export function useStudentVoice({ onFinal, onError }: Options) {
  const [engine, setEngine] = useState<VoiceEngine>("checking");
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const reportError = useCallback((msg: string) => errorRef.current?.(msg), []);

  useEffect(() => {
    let alive = true;
    voiceAvailable().then((ok) => alive && setEngine(ok ? "elevenlabs" : "browser"));
    return () => {
      alive = false;
    };
  }, []);

  const useEleven = engine === "elevenlabs";

  // ---- Listening -----------------------------------------------------------
  const browserMic = useSpeechRecognition(onFinal);
  const browserMicLevel = useMicLevel(!useEleven && browserMic.listening);
  const elevenMic = useElevenLabsMic({ onFinal, onError: reportError });

  // ---- Talking -------------------------------------------------------------
  const [speakingLevel, setSpeakingLevel] = useState(0);
  const [simulating, setSimulating] = useState(false); // browser voice has no real level
  const playbackRef = useRef<Playback | null>(null);
  const tokenRef = useRef(0);
  const onEndRef = useRef<(() => void) | null>(null);
  const bump = useRef(0);

  /** Stop the student talking (calls the pending onEnd). */
  const stop = useCallback(() => {
    tokenRef.current++;
    playbackRef.current?.stop();
    playbackRef.current = null;
    browserStop();
    setSimulating(false);
    setSpeakingLevel(0);
    const end = onEndRef.current;
    onEndRef.current = null;
    end?.();
  }, []);

  const speak = useCallback(
    (text: string, { onEnd }: { onEnd?: () => void } = {}) => {
      stop();
      const token = tokenRef.current;
      onEndRef.current = onEnd ?? null;
      const ended = () => {
        if (token !== tokenRef.current) return; // stopped or replaced
        setSimulating(false);
        setSpeakingLevel(0);
        onEndRef.current = null;
        onEnd?.();
      };
      const speakWithBrowser = () => {
        if (token !== tokenRef.current) return;
        setSimulating(true);
        browserSpeak(text, { onBoundary: () => (bump.current = 0.45), onEnd: ended });
      };

      if (engineRef.current !== "elevenlabs") return speakWithBrowser();

      audioUrlFor(text)
        .then((url) => {
          if (token !== tokenRef.current) return;
          const playback = playWithLevel(
            url,
            (lvl) => token === tokenRef.current && setSpeakingLevel(lvl),
          );
          playbackRef.current = playback;
          return playback.done.then(ended);
        })
        .catch((err) => {
          console.warn("ElevenLabs voice failed, using the browser voice instead:", err);
          speakWithBrowser();
        });
    },
    [stop],
  );

  // Browser voice: fake a level so the blob still moves (word boundaries add a kick)
  useEffect(() => {
    if (!simulating) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const e = (t - start) / 1000;
      bump.current *= 0.9;
      const base = 0.25 + 0.25 * Math.abs(Math.sin(e * 7.3)) * (0.6 + 0.4 * Math.sin(e * 2.1));
      setSpeakingLevel(Math.min(1, base + bump.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [simulating]);

  // Stop everything when the page closes
  useEffect(() => () => stop(), [stop]);

  // ---- One shape for the page, whichever engine is in use ------------------
  const toggle = useCallback(() => {
    if (engineRef.current === "checking") return;
    // Starting to talk interrupts the student, so it doesn't hear itself
    const starting =
      engineRef.current === "elevenlabs" ? !elevenMic.listening : !browserMic.listening;
    if (starting) stop();
    if (engineRef.current === "elevenlabs") elevenMic.toggle();
    else browserMic.toggle();
  }, [elevenMic, browserMic, stop]);

  return {
    engine,
    supported: engine === "checking" ? false : useEleven ? true : browserMic.supported,
    /** True while you're talking (and, for ElevenLabs, while it's being transcribed). */
    listening: useEleven ? elevenMic.listening || elevenMic.transcribing : browserMic.listening,
    transcribing: useEleven && elevenMic.transcribing,
    interim: useEleven
      ? elevenMic.transcribing
        ? "Got it, writing that down…"
        : ""
      : browserMic.interim,
    wrappingUp: useEleven ? elevenMic.wrappingUp : browserMic.wrappingUp,
    micLevel: useEleven ? elevenMic.level : browserMicLevel,
    toggle,
    speakingLevel,
    speak,
    stop,
  };
}
