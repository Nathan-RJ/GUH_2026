import { STATE_META, STATE_ORDER } from "@/lib/states";
import { cn } from "@/lib/utils";

export function StateLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-medium text-muted-foreground", className)}>
      {STATE_ORDER.map((s) => (
        <span key={s} className="inline-flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full ring-2 ring-background", STATE_META[s].bg)} />
          {STATE_META[s].label}
        </span>
      ))}
    </div>
  );
}

export function StateDot({ state, className }: { state: keyof typeof STATE_META; className?: string }) {
  return <span className={cn("inline-block h-3 w-3 rounded-full transition-colors duration-700", STATE_META[state].bg, className)} />;
}
