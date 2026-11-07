import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSilenceWatcher, SPEECH_SILENCE_MS, SPEECH_WARN_MS } from "@/hooks/use-speech";

describe("long pause ends the student's turn", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = () => {
    const warn = vi.fn();
    const done = vi.fn();
    return { w: createSilenceWatcher({ onWarn: warn, onDone: done }), warn, done };
  };

  it("finishes the turn after a pause of the full silence length", () => {
    const { w, warn, done } = make();
    w.arm();
    vi.advanceTimersByTime(SPEECH_SILENCE_MS - 1);
    expect(done).not.toHaveBeenCalled();
    expect(warn).toHaveBeenLastCalledWith(true);
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenLastCalledWith(false);
  });

  it("keeps listening while the student is still talking", () => {
    const { w, done } = make();
    w.arm();
    // New words arrive just before the deadline, twice over.
    vi.advanceTimersByTime(SPEECH_SILENCE_MS - 100);
    w.arm();
    vi.advanceTimersByTime(SPEECH_SILENCE_MS - 100);
    w.arm();
    vi.advanceTimersByTime(SPEECH_SILENCE_MS - 100);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("cancels when the student taps the mic to stop", () => {
    const { w, warn, done } = make();
    w.arm();
    vi.advanceTimersByTime(SPEECH_SILENCE_MS - SPEECH_WARN_MS);
    expect(warn).toHaveBeenLastCalledWith(true);
    w.cancel();
    vi.advanceTimersByTime(SPEECH_SILENCE_MS * 2);
    expect(done).not.toHaveBeenCalled();
    expect(warn).toHaveBeenLastCalledWith(false);
  });
});
