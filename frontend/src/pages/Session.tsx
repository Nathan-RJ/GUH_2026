// Session page: the prompt + attachments on the left, a chat on the right.
// This is the blank canvas to build the main sections of the app on.
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { attachmentUrl, getSession, sendMessage } from "../api";
import type { Session as SessionData } from "../types";
import { formatBytes } from "../utils";
import { AutoSpeak, MicButton, SpeakButton } from "../voice";

export default function Session() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    getSession(id).then(setSession).catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length]);

  // Used by both the text box and the microphone. Returns true if it sent.
  async function send(message: string): Promise<boolean> {
    if (!id || !message.trim()) return false;
    setSending(true);
    setError(null);
    try {
      setSession(await sendMessage(id, message));
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setSending(false);
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (await send(text)) setText("");
  }

  if (error && !session) {
    return (
      <main className="home">
        <p className="error">{error}</p>
        <Link to="/">Back to start</Link>
      </main>
    );
  }
  if (!session) return <main className="home muted">Loading...</main>;

  return (
    <div className="session">
      <aside className="sidebar">
        <Link to="/" className="muted">
          &larr; New session
        </Link>

        <h2>Prompt</h2>
        <p className="prompt">{session.prompt || <span className="muted">(none)</span>}</p>

        <h2>Attachments</h2>
        {session.attachments.length === 0 ? (
          <p className="muted">None</p>
        ) : (
          <ul className="file-list">
            {session.attachments.map((a) => (
              <li key={a.name}>
                <a href={attachmentUrl(session.id, a.name)} target="_blank" rel="noreferrer">
                  {a.original_name}
                </a>
                <span className="muted">{formatBytes(a.size)}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Add more sidebar sections here */}
      </aside>

      <section className="chat">
        <div className="messages">
          {session.messages.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              {m.text}
              {m.role === "assistant" && <SpeakButton text={m.text} />}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {error && <p className="error">{error}</p>}

        <form onSubmit={handleSend} className="composer">
          <AutoSpeak messages={session.messages} />
          <MicButton onTranscript={send} disabled={sending} />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
          />
          <button type="submit" disabled={sending || !text.trim()}>
            {sending ? "..." : "Send"}
          </button>
        </form>
      </section>
    </div>
  );
}
