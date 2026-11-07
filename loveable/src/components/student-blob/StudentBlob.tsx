import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";
import { approach, blobPath, blobRadii, mouthPath, type MouthShape } from "./shape";

/** Who's talking: same values as the old VoiceOrb, so it's a drop-in swap. */
export type BlobSpeaker = "idle" | "you" | "ai" | "thinking";
/** How the student feels about the topic so far. */
export type BlobMood = "confused" | "neutral" | "happy";

interface Props {
  /** Current voice loudness, 0–1 (yours while you talk, the student's while it talks). */
  level: number;
  speaker: BlobSpeaker;
  mood?: BlobMood;
  className?: string;
}

// Drawing space (the SVG scales to the container)
const CX = 150;
const CY = 158;
const R = 92;
const EYE_Y = 142;
const EYE_DX = 30;
const MOUTH_Y = 186;

const MOUTHS: Record<BlobSpeaker, MouthShape> = {
  idle: { width: 15, open: 1.5, curve: 6, shift: 0 },
  you: { width: 7, open: 4.5, curve: 0, shift: 0 }, // attentive little "o"
  ai: { width: 13, open: 2, curve: 2, shift: 0 }, // opened further by the voice level
  thinking: { width: 9, open: 1, curve: -1, shift: 7 },
};

// Starting shapes, so the blob is visible before animation begins (and when server-rendered)
const INITIAL_BODY = blobPath(blobRadii(10, R, 0, 0.12), CX, CY);
const INITIAL_MOUTH = mouthPath(CX, MOUTH_Y, MOUTHS.idle);
const INITIAL_BROWS = [-1, 1].map((side) => {
  const x = CX + side * EYE_DX;
  return `M ${x + side * 12} ${EYE_Y - 26} Q ${x} ${EYE_Y - 29} ${x - side * 10} ${EYE_Y - 26}`;
});

// Where the pupils look
const GAZE: Record<BlobSpeaker, [number, number]> = {
  idle: [0, 1],
  you: [0, 3], // looking at you
  ai: [0, 1],
  thinking: [5, -6], // up and away
};

/** The AI student: a squishy green blob whose mouth moves with its voice. */
export function StudentBlob({ level, speaker, mood = "neutral", className }: Props) {
  const gradId = `blob-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const live = useRef({ level, speaker, mood });
  live.current = { level, speaker, mood };

  const bodyRef = useRef<SVGGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const pupilRefs = useRef<(SVGCircleElement | null)[]>([]);
  const browRefs = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const mouth = { ...MOUTHS.idle };
    const gaze = { x: 0, y: 0 };
    let energy = 0;
    let lvl = 0;
    let brow = 0;
    let nextBlink = performance.now() + 2500;
    let blinkUntil = 0;
    let raf = 0;
    const t0 = performance.now();

    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      const { level: target, speaker, mood } = live.current;

      // Voice level: open fast, close a little slower (reads as natural speech)
      lvl = target > lvl ? approach(lvl, target, 0.55) : approach(lvl, target, 0.25);
      const talking = speaker === "ai" || speaker === "you";
      energy = approach(
        energy,
        talking ? 0.35 + lvl * 0.65 : speaker === "thinking" ? 0.3 : 0.12,
        0.08,
      );

      // Body outline + squash/stretch with the voice
      const radii = blobRadii(10, R, reduceMotion ? 0 : t, reduceMotion ? 0 : energy);
      pathRef.current?.setAttribute("d", blobPath(radii, CX, CY));
      const breathe = reduceMotion ? 0 : Math.sin(t * 1.6) * 0.018;
      const voice = speaker === "ai" ? lvl : speaker === "you" ? lvl * 0.4 : 0;
      const sx = 1 + breathe * 0.5 + voice * 0.05;
      const sy = 1 + breathe + voice * 0.09;
      const bob = speaker === "thinking" && !reduceMotion ? Math.sin(t * 3) * 2 : 0;
      // Scale from the bottom so it squashes like it's sitting on the floor
      bodyRef.current?.setAttribute(
        "transform",
        `translate(${CX} ${CY + R + bob}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${-CX} ${-(CY + R)})`,
      );
      if (bodyRef.current) {
        const glow = 18 + voice * 42;
        bodyRef.current.style.filter = `drop-shadow(0 0 ${glow.toFixed(1)}px color-mix(in oklab, var(--brand) ${(30 + voice * 45).toFixed(0)}%, transparent))`;
      }
      shadowRef.current?.setAttribute("rx", (78 * sx).toFixed(2));

      // Mouth: lip-sync while the student talks
      const goal = MOUTHS[speaker];
      const moodCurve =
        speaker === "idle" ? (mood === "happy" ? 4 : mood === "confused" ? -9 : 0) : 0;
      mouth.width = approach(mouth.width, goal.width - (speaker === "ai" ? lvl * 2 : 0), 0.25);
      mouth.open =
        speaker === "ai"
          ? approach(mouth.open, goal.open + lvl * 15, 0.6)
          : approach(mouth.open, goal.open, 0.25);
      mouth.curve = approach(mouth.curve, goal.curve + moodCurve, 0.2);
      mouth.shift = approach(mouth.shift, goal.shift, 0.15);
      mouthRef.current?.setAttribute("d", mouthPath(CX, MOUTH_Y, mouth));

      // Eyes: gaze, a little wander, and blinking
      const [gx, gy] = GAZE[speaker];
      const wander = speaker === "idle" && !reduceMotion ? Math.sin(t * 0.7) * 3 : 0;
      gaze.x = approach(gaze.x, gx + wander, 0.12);
      gaze.y = approach(gaze.y, gy, 0.12);
      pupilRefs.current.forEach((p, i) => {
        p?.setAttribute("cx", (CX + (i === 0 ? -EYE_DX : EYE_DX) + gaze.x).toFixed(2));
        p?.setAttribute("cy", (EYE_Y + gaze.y).toFixed(2));
      });
      if (now > nextBlink) {
        blinkUntil = now + 130;
        nextBlink = now + 2200 + Math.random() * 3200;
      }
      const lid = now < blinkUntil ? 0.1 : speaker === "you" ? 1.12 : 1; // wide-eyed while listening
      eyesRef.current?.setAttribute(
        "transform",
        `translate(0 ${EYE_Y}) scale(1 ${lid}) translate(0 ${-EYE_Y})`,
      );

      // Eyebrows: worried when confused, raised when listening or thinking
      const browGoal =
        speaker === "thinking"
          ? 1
          : speaker === "you"
            ? 0.6
            : mood === "confused"
              ? -1
              : mood === "happy"
                ? 0.4
                : 0;
      brow = approach(brow, browGoal, 0.1);
      browRefs.current.forEach((b, i) => {
        const side = i === 0 ? -1 : 1;
        const x = CX + side * EYE_DX;
        const lift = brow > 0 ? brow * 6 : 0;
        // Confused: inner ends go up. Thinking: only one brow goes up.
        const tilt = brow < 0 ? -brow * 6 : 0;
        const extra = speaker === "thinking" && i === 1 ? 5 : 0;
        const outerY = EYE_Y - 26 - lift - extra;
        const innerY = EYE_Y - 26 - lift - extra - tilt;
        const outerX = x + side * 12;
        const innerX = x - side * 10;
        b?.setAttribute(
          "d",
          `M ${outerX} ${outerY.toFixed(2)} Q ${x} ${(Math.min(outerY, innerY) - 3).toFixed(2)} ${innerX} ${innerY.toFixed(2)}`,
        );
      });

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const label =
    speaker === "ai"
      ? "Your student is talking"
      : speaker === "you"
        ? "Your student is listening"
        : speaker === "thinking"
          ? "Your student is thinking"
          : "Your student";

  return (
    <div
      className={cn(
        "relative grid h-[300px] w-[300px] place-items-center sm:h-[320px] sm:w-[320px]",
        className,
      )}
      role="img"
      aria-label={label}
    >
      {/* Ripples while you talk */}
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute inset-10 rounded-full border border-brand/40 transition-all duration-150"
          style={{
            transform: `scale(${1 + (speaker === "you" ? level : 0) * (0.35 + i * 0.25)})`,
            opacity: speaker === "you" ? Math.max(0.08, 0.5 - i * 0.15) : 0,
          }}
        />
      ))}

      <svg viewBox="0 0 300 300" className="relative h-full w-full overflow-visible" aria-hidden>
        <defs>
          <radialGradient id={gradId} cx="35%" cy="28%" r="80%">
            <stop offset="0%" stopColor="oklch(0.92 0.12 145)" />
            <stop offset="48%" stopColor="var(--brand)" />
            <stop offset="100%" stopColor="oklch(0.45 0.14 155)" />
          </radialGradient>
        </defs>

        {/* Floor shadow */}
        <ellipse
          ref={shadowRef}
          cx={CX}
          cy={CY + R + 8}
          rx={78}
          ry={9}
          fill="black"
          opacity={0.28}
        />

        <g ref={bodyRef}>
          <path ref={pathRef} d={INITIAL_BODY} fill={`url(#${gradId})`} />
          {/* Shine */}
          <ellipse
            cx={CX - 38}
            cy={CY - 48}
            rx={22}
            ry={13}
            fill="white"
            opacity={0.28}
            transform={`rotate(-28 ${CX - 38} ${CY - 48})`}
          />

          {/* Face */}
          <g ref={eyesRef}>
            {[-1, 1].map((side, i) => (
              <g key={side}>
                <ellipse cx={CX + side * EYE_DX} cy={EYE_Y} rx={14} ry={16} fill="white" />
                <circle
                  ref={(el) => void (pupilRefs.current[i] = el)}
                  cx={CX + side * EYE_DX}
                  cy={EYE_Y}
                  r={7}
                  fill="var(--ink)"
                />
                <circle
                  cx={CX + side * EYE_DX - 3}
                  cy={EYE_Y - 4}
                  r={2.2}
                  fill="white"
                  opacity={0.9}
                  pointerEvents="none"
                />
              </g>
            ))}
          </g>
          {[0, 1].map((i) => (
            <path
              key={i}
              ref={(el) => void (browRefs.current[i] = el)}
              d={INITIAL_BROWS[i]}
              fill="none"
              stroke="var(--brand-foreground)"
              strokeWidth={4}
              strokeLinecap="round"
              opacity={0.75}
            />
          ))}
          <path
            ref={mouthRef}
            d={INITIAL_MOUTH}
            fill="var(--brand-foreground)"
            stroke="var(--brand-foreground)"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        </g>
      </svg>

      {/* Thinking dots */}
      {speaker === "thinking" && (
        <div className="absolute right-8 top-6 flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
