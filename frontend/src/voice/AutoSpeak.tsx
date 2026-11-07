// Toggle that reads each new assistant reply aloud as it arrives.
// The on/off choice is remembered in this browser.
import { useEffect, useRef, useState } from "react";
import type { Message } from "../types";
import { SpeakerIcon, SpeakerOffIcon } from "./icons";
import { play, stop } from "./player";
import { getVoiceStatus } from "./voiceApi";

const STORAGE_KEY = "voice:autoSpeak";

function readPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function savePref(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* storage blocked: fine, just not remembered */
  }
}

export function AutoSpeak({ messages }: { messages: Message[] }) {
  const [enabled, setEnabled] = useState(readPref);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef(messages.length); // only read replies that arrive from now on

  useEffect(() => {
    getVoiceStatus()
      .then((s) => setAvailable(s.enabled))
      .catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    const fresh = messages.slice(seen.current);
    seen.current = messages.length;
    if (!enabled || !available) return;
    const reply = [...fresh].reverse().find((m) => m.role === "assistant");
    if (reply) {
      setError(null);
      play(reply.text).catch((err: Error) => setError(err.message));
    }
  }, [messages, enabled, available]);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    savePref(next);
    if (!next) stop();
  }

  const label = !available
    ? "Voice is off: add ELEVENLABS_API_KEY to backend/.env"
    : error
      ? `Couldn't read the reply: ${error}`
      : enabled
        ? "Reading replies aloud (click to turn off)"
        : "Replies are silent (click to read them aloud)";

  return (
    <button
      type="button"
      className={`voice-button ${enabled && available ? "on" : ""}`}
      onClick={toggle}
      disabled={!available}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
      data-error={error ? "true" : undefined}
    >
      {enabled && available ? <SpeakerIcon /> : <SpeakerOffIcon />}
    </button>
  );
}
