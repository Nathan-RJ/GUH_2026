import { cn } from "@/lib/utils";

/** Reply-style uppercase label with a coloured dot. */
export function Eyebrow({ dot, children, className }: { dot: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("label-text inline-flex items-center gap-2.5", className)}>
      <span className={cn("h-2 w-2 rounded-full", dot)} /> {children}
    </span>
  );
}
