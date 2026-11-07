import type { DocumentResult, DocumentUpload } from "./types";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_ACCEPT = ".pdf,.txt,.md";

export function validateDocument({ file, title, kind }: DocumentUpload): string | null {
  if (kind !== "content") return "Exam and rubric uploads are disabled until private handling is available.";
  if (!title.trim() || title.trim().length > 200) return "Enter a title of 1 to 200 characters.";
  if (!/\.(pdf|txt|md)$/i.test(file.name)) return "Choose a PDF, TXT or MD file.";
  if (!file.size) return "The document is empty.";
  if (file.size > MAX_DOCUMENT_BYTES) return "The document exceeds the 10 MB limit.";
  return null;
}

export function processDocument(doc: DocumentUpload, onUploaded?: () => void): Promise<DocumentResult> {
  const error = validateDocument(doc);
  if (error) return Promise.reject(new Error(error));
  const body = new FormData();
  body.append("document", doc.file, doc.file.name);
  body.append("title", doc.title.trim());
  // Empty locally (Vite proxy) or with a production same-origin /api reverse proxy.
  const base = (import.meta.env["VITE_API_BASE_URL"] ?? "").replace(/\/$/, "");
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/api/lessons/prepare`);
    xhr.timeout = 135_000;
    xhr.upload.onload = () => onUploaded?.();
    xhr.onerror = () => reject(new Error("Cannot reach the upload server. Check the backend URL and connection; check n8n executions before retrying."));
    xhr.ontimeout = () => reject(new Error("Timed out. Processing may still finish; check n8n executions before retrying."));
    xhr.onabort = () => reject(new Error("Upload interrupted. Completion is unknown."));
    xhr.onload = () => {
      let data: Record<string, unknown>;
      try { data = JSON.parse(xhr.responseText); }
      catch { reject(new Error("The upload server returned an invalid response. Check the API deployment and n8n execution log.")); return; }
      if (!data || typeof data !== "object") { reject(new Error("Invalid upload response.")); return; }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(typeof data["error"] === "string" ? data["error"] : `Upload failed (HTTP ${xhr.status}).`));
      } else if (xhr.status !== 202 && data["status"] === "draft" && typeof data["lesson_id"] === "string" && data["lesson_id"].trim()) {
        resolve({ status: "draft", lesson_id: data["lesson_id"] });
      } else {
        resolve({ status: "unconfirmed", message: typeof data["message"] === "string" ? data["message"] : "No saved lesson was confirmed. Check n8n executions before retrying." });
      }
    };
    xhr.send(body); // Browser supplies the multipart boundary; do not set Content-Type.
  });
}
