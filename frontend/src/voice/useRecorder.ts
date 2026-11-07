// Records from the microphone with the browser's MediaRecorder.
import { useEffect, useRef, useState } from "react";

export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("This browser can't record audio.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  }

  /** Stop recording and get the audio. */
  function stop(): Promise<Blob> {
    const recorder = recorderRef.current;
    if (!recorder) return Promise.reject(new Error("Not recording."));
    return new Promise((resolve) => {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((track) => track.stop()); // release the mic
        recorderRef.current = null;
        setRecording(false);
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      };
      recorder.stop();
    });
  }

  // Release the microphone if the page closes mid-recording
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (!recorder) return;
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { recording, start, stop };
}
