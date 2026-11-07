import { cn } from "@/lib/utils";

export type OrbSpeaker = "idle" | "you" | "ai" | "thinking";

/** A talking circle: grows and ripples with the current voice level (0–1). */
export function VoiceOrb({ level, speaker }: { level: number; speaker: OrbSpeaker }) {
  const scale = 1 + level * 0.28;
  return (
    <div className="relative grid h-[300px] w-[300px] place-items-center sm:h-[320px] sm:w-[320px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute inset-8 rounded-full border border-brand/40 transition-all duration-150"
          style={{ transform: `scale(${1 + level * (0.35 + i * 0.25)})`, opacity: Math.max(0.08, 0.55 - i * 0.16) * (speaker === "idle" ? 0.35 : 1) }}
        />
      ))}
      <div
        className={cn("relative h-44 w-44 rounded-full transition-transform duration-100 ease-out sm:h-48 sm:w-48", speaker === "idle" && "animate-orb-breathe")}
        style={{ transform: `scale(${scale})`, boxShadow: `0 0 ${40 + level * 90}px color-mix(in oklab, var(--brand) ${28 + level * 40}%, transparent)` }}
      >
        <div className="bg-orb absolute inset-0 rounded-full" />
        <div className="absolute inset-0 rounded-full border border-ink-foreground/20" />
        <div className={cn("absolute inset-3 rounded-full border border-dashed border-brand-foreground/20", speaker !== "idle" && "animate-orb-spin")} />
        {speaker === "thinking" && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand-foreground/70" style={{ animationDelay: `${i * 120}ms` }} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
