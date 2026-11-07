import { afterEach, describe, expect, it, vi } from "vitest";
import { extensionFor, voiceAvailable } from "@/voice/api";
import { levelFromTimeDomain } from "@/voice/levels";

describe("ElevenLabs availability (decides voice vs browser fallback)", () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (body: string, init: ResponseInit = {}) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body, init)),
    );

  it("is on when the backend has a key", async () => {
    respond(JSON.stringify({ enabled: true }), { headers: { "Content-Type": "application/json" } });
    expect(await voiceAvailable()).toBe(true);
  });

  it("is off when the backend has no key", async () => {
    respond(JSON.stringify({ enabled: false }));
    expect(await voiceAvailable()).toBe(false);
  });

  it("is off when there's no backend (network error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );
    expect(await voiceAvailable()).toBe(false);
  });

  it("is off when /api returns a web page instead (e.g. Lovable's preview)", async () => {
    respond("<!doctype html><html></html>", { headers: { "Content-Type": "text/html" } });
    expect(await voiceAvailable()).toBe(false);
  });

  it("is off on a server error", async () => {
    respond("oops", { status: 500 });
    expect(await voiceAvailable()).toBe(false);
  });
});

describe("audio helpers", () => {
  it("measures silence as 0 and loud audio as louder", () => {
    const silent = new Uint8Array(512).fill(128);
    const loud = new Uint8Array(512).map((_, i) => (i % 2 ? 200 : 56));
    expect(levelFromTimeDomain(silent)).toBe(0);
    expect(levelFromTimeDomain(loud)).toBeGreaterThan(0.5);
    expect(levelFromTimeDomain(loud)).toBeLessThanOrEqual(1);
  });

  it("names recordings by browser format", () => {
    expect(extensionFor("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionFor("audio/mp4")).toBe("mp4");
    expect(extensionFor("audio/ogg")).toBe("ogg");
  });
});
