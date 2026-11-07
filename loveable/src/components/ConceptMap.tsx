import { useEffect, useRef, useState } from "react";
import type { Concept } from "@/services/types";
import { STATE_META } from "@/lib/states";

const W = 520;
const H = 440;
const CX = W / 2;
const CY = H / 2;

export function ConceptMap({ title, concepts }: { title: string; concepts: Concept[] }) {
  const prev = useRef<Record<string, string>>({});
  const [pulse, setPulse] = useState<Record<string, number>>({});

  useEffect(() => {
    const changed: Record<string, number> = {};
    for (const c of concepts) {
      if (prev.current[c.id] && prev.current[c.id] !== c.state) changed[c.id] = Date.now();
      prev.current[c.id] = c.state;
    }
    if (Object.keys(changed).length) setPulse((p) => ({ ...p, ...changed }));
  }, [concepts]);

  const r = Math.min(W, H) * 0.36;
  const nodes = concepts.map((c, i) => {
    const a = (i / concepts.length) * Math.PI * 2 - Math.PI / 2;
    return { c, x: CX + Math.cos(a) * r * 1.15, y: CY + Math.sin(a) * r };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full overflow-visible" role="img" aria-label={`Concept map for ${title}`}>
      {nodes.map((n, i) => {
        const next = nodes[(i + 1) % nodes.length]!;
        return (
          <g key={`l-${n.c.id}`}>
            <line x1={CX} y1={CY} x2={n.x} y2={n.y} stroke={STATE_META[n.c.state].fill} strokeWidth={2} strokeOpacity={0.6} style={{ transition: "stroke 0.8s ease" }} />
            {nodes.length > 2 && (
              <line x1={n.x} y1={n.y} x2={next.x} y2={next.y} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 7" />
            )}
          </g>
        );
      })}
      <g>
        <circle cx={CX} cy={CY} r={57} fill="var(--card)" stroke="var(--border)" strokeWidth={1} />
        <circle cx={CX} cy={CY} r={49} fill="var(--ink)" />
        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fill="var(--ink-foreground)" fontSize={14} fontWeight={600} fontFamily="var(--font-display)">
          {title}
        </text>
      </g>
      {nodes.map((n) => {
        const fill = STATE_META[n.c.state].fill;
        const key = pulse[n.c.id] ?? 0;
        return (
          <g key={`${n.c.id}-${key}`}>
            {key > 0 && <circle cx={n.x} cy={n.y} r={37} fill="none" stroke={fill} strokeWidth={2} className="animate-ring-out" />}
            <g className={key > 0 ? "animate-node-pulse" : undefined}>
              <circle cx={n.x} cy={n.y} r={37} fill={fill} stroke="var(--card)" strokeWidth={5} style={{ transition: "fill 0.8s ease", filter: "drop-shadow(0 8px 10px oklch(0 0 0 / 0.12))" }} />
              <circle cx={n.x - 10} cy={n.y - 11} r={7} fill="var(--card)" opacity={0.22} />
            </g>
            <foreignObject x={n.x - 70} y={n.y + 43} width={140} height={40}>
              <div className="text-center text-[12px] font-semibold leading-tight tracking-[-0.01em] text-foreground">{n.c.label}</div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}
