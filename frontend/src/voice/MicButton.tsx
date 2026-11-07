// Click to start talking, click again to stop. The speech is transcribed
// and handed to onTranscript (e.g. to send it as a chat message).
import { useState } from "react";
import { MicIcon, StopIcon } from "./icons";
import { stop as stopPlayback } from "./player";
import { useRecorder } from "./useRecorder";
import { transcribe } from "./voiceApi";

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function MicButton({ onTranscript, disabled = false }: Props) {
  const { recording, start, stop } = useRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    try {
      if (!recording) {
        stopPlayback(); // don't record the student talking
        await start();
        return;
      }
      const audio = await stop();
      setTranscribing(true);
      const text = await transcribe(audio);
      if (!text) throw new Error("Didn't catch that. Try again.");
      onTranscript(text);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setTranscribing(false);
    }
  }

  const label = recording ? "Stop and send" : transcribing ? "Transcribing..." : "Speak";

  return (
    <span className="voice-mic">
      <button
        type="button"
        className={`voice-button ${recording ? "recording" : ""}`}
        onClick={handleClick}
        disabled={transcribing || (disabled && !recording)}
        aria-label={label}
        title={label}
      >
        {recording ? <StopIcon /> : transcribing ? <span className="voice-dots">...</span> : <MicIcon />}
      </button>
      {error && (
        <span className="voice-error" role="alert" onClick={() => setError(null)}>
          {error}
        </span>
      )}
    </span>
  );
}

function friendlyError(err: unknown): string {
  if (err instanceof DOMException && err.name === "NotAllowedError") {
    return "Microphone access was blocked. Allow it in the browser's address bar.";
  }
  if (err instanceof DOMException && err.name === "NotFoundError") {
    return "No microphone found.";
  }
  return err instanceof Error ? err.message : "Something went wrong with the microphone.";
}
