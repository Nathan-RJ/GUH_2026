import { useEffect, useRef, useState } from "react";
import type { Concept } from "@/services/types";
import { STATE_META } from "@/lib/states";
import { cn } from "@/lib/utils";

/**
 * The topic's concepts as rows of circles, each coloured by how well it has
 * been explained. A circle pops when its state changes.
 */
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

  return (
    <ul
      aria-label={`Concepts in ${title}`}
      className="grid h-full content-center justify-items-center gap-x-4 gap-y-8 py-6 [grid-template-columns:repeat(auto-fit,minmax(136px,1fr))]"
    >
      {concepts.map((c) => {
        const meta = STATE_META[c.state];
        const key = pulse[c.id] ?? 0;
        return (
          <li key={c.id} className="flex w-full max-w-[170px] flex-col items-center text-center">
            <span key={key} className="relative grid h-24 w-24 place-items-center">
              {key > 0 && (
                <span
                  className="animate-ring-out absolute inset-0 rounded-full border-2"
                  style={{ borderColor: meta.fill }}
                />
              )}
              <span
                className={cn(
                  "absolute inset-0 rounded-full border-[5px] border-card",
                  key > 0 && "animate-node-pulse",
                )}
                style={{
                  backgroundColor: meta.fill,
                  boxShadow: "0 8px 14px oklch(0 0 0 / 0.12)",
                  transition: "background-color 0.8s ease",
                }}
              />
              {/* Shine */}
              <span className="absolute left-[22%] top-[20%] h-4 w-4 rounded-full bg-card opacity-25" />
            </span>
            <span className="mt-3 text-sm font-semibold leading-tight tracking-[-0.01em] text-foreground">
              {c.label}
            </span>
            <span
              className={cn(
                "mt-1 text-xs font-medium",
                c.state === "not_covered" ? "text-muted-foreground" : meta.text,
              )}
            >
              {meta.short}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
