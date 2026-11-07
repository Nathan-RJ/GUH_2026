// Microphone -> ElevenLabs transcript. Records with MediaRecorder, and ends the
// turn by itself after a pause, like the browser speech mode does.
import { useCallback, useEffect, useRef, useState } from "react";
import { createSilenceWatcher, type SilenceWatcher } from "@/hooks/use-speech";
import { transcribe } from "./api";
import { SPEECH_LEVEL, levelFromTimeDomain } from "./levels";
import { audioContext } from "./player";

interface Options {
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}

export function useElevenLabsMic({ onFinal, onError }: Options) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [wrappingUp, setWrappingUp] = useState(false);
  const [level, setLevel] = useState(0);

  const cbRef = useRef({ onFinal, onError });
  cbRef.current = { onFinal, onError };
  const recorderRef = useRef<MediaRecorder | null>(null);
  const partsRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef(0);
  const silenceRef = useRef<SilenceWatcher | null>(null);

  /** Stop the level meter and give the microphone back. */
  const release = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    silenceRef.current?.cancel();
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLevel(0);
  }, []);

  /** Stop recording and turn what was said into text. */
  const finish = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    recorder.onstop = async () => {
      release();
      setListening(false);
      const audio = new Blob(partsRef.current, { type: recorder.mimeType || "audio/webm" });
      partsRef.current = [];
      if (audio.size === 0) return;
      setTranscribing(true);
      try {
        const text = await transcribe(audio);
        if (text) cbRef.current.onFinal(text);
        else cbRef.current.onError("Didn't catch that. Try again.");
      } catch (err) {
        cbRef.current.onError(err instanceof Error ? err.message : "Couldn't transcribe that.");
      } finally {
        setTranscribing(false);
      }
    };
    if (recorder.state !== "inactive") recorder.stop();
  }, [release]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      cbRef.current.onError("This browser can't record audio.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const blocked = err instanceof DOMException && err.name === "NotAllowedError";
      cbRef.current.onError(
        blocked
          ? "Microphone access was blocked. Allow it in the address bar."
          : "Couldn't open the microphone.",
      );
      return;
    }
    streamRef.current = stream;

    const recorder = new MediaRecorder(stream);
    partsRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) partsRef.current.push(e.data);
    };
    recorder.start();
    recorderRef.current = recorder;
    setListening(true);

    // Loudness for the blob, plus "stopped talking" detection
    const silence = createSilenceWatcher({ onWarn: setWrappingUp, onDone: finish });
    silenceRef.current = silence;
    const ac = audioContext();
    const analyser = ac.createAnalyser();
    analyser.fftSize = 512;
    const source = ac.createMediaStreamSource(stream);
    source.connect(analyser);
    sourceRef.current = source;
    const buf = new Uint8Array(analyser.fftSize);
    let lastArm = 0;
    const tick = (now: number) => {
      analyser.getByteTimeDomainData(buf);
      const lvl = levelFromTimeDomain(buf);
      setLevel(lvl);
      // Only real speech restarts the countdown; a pause lets it run out.
      if (lvl > SPEECH_LEVEL && now - lastArm > 150) {
        lastArm = now;
        silence.arm();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [finish]);

  const toggle = useCallback(() => {
    if (transcribing) return;
    if (recorderRef.current) finish();
    else void start();
  }, [transcribing, finish, start]);

  // Let go of the microphone if the page closes mid-recording
  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      release();
    },
    [release],
  );

  return { listening, transcribing, wrappingUp, level, toggle };
}
