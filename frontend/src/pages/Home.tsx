// Home page: type a prompt, attach any files, start a session.
import { FormEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSession } from "../api";
import { formatBytes } from "../utils";

export default function Home() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFiles(list: FileList | null) {
    if (list) setFiles((current) => [...current, ...Array.from(list)]);
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim() && files.length === 0) {
      setError("Add a prompt or at least one attachment.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = await createSession(prompt, files);
      navigate(`/session/${session.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <main className="home">
      <h1>Start a session</h1>
      <p className="muted">Write a prompt and attach any files you want to use.</p>

      <form onSubmit={handleSubmit} className="card">
        <label htmlFor="prompt">Prompt</label>
        <textarea
          id="prompt"
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What do you want to work on?"
        />

        <label>Attachments</label>
        <div
          className={`dropzone ${dragging ? "dragging" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          Drop files here or click to choose
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = ""; // allow picking the same file again
            }}
          />
        </div>

        {files.length > 0 && (
          <ul className="file-list">
            {files.map((file, i) => (
              <li key={`${file.name}-${i}`}>
                <span>{file.name}</span>
                <span className="muted">{formatBytes(file.size)}</span>
                <button type="button" className="link" onClick={() => removeFile(i)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Starting..." : "Start session"}
        </button>
      </form>
    </main>
  );
}
