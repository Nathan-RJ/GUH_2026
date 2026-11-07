// Small button that reads one message out loud (click again to stop).
import { useEffect, useState } from "react";
import { SpeakerIcon, StopIcon } from "./icons";
import { currentlyPlaying, play, stop, subscribe } from "./player";

export function SpeakButton({ text }: { text: string }) {
  const [playing, setPlaying] = useState(currentlyPlaying() === text);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribe((now) => setPlaying(now === text)), [text]);

  function handleClick() {
    setError(null);
    if (playing) {
      stop();
      return;
    }
    play(text).catch((err: Error) => setError(err.message));
  }

  const label = playing ? "Stop reading" : "Read aloud";
  return (
    <button
      type="button"
      className="voice-speak"
      onClick={handleClick}
      aria-label={error ?? label}
      title={error ?? label}
      data-error={error ? "true" : undefined}
    >
      {playing ? <StopIcon /> : <SpeakerIcon />}
    </button>
  );
}
