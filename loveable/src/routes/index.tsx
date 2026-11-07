import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reply 2 Me — Learn by teaching" },
      { name: "description", content: "Teach an AI student out loud. Your explanations are graded against your teacher's rubric." },
      { property: "og:title", content: "Reply 2 Me — Learn by teaching" },
      { property: "og:description", content: "Teach an AI student out loud. Prove you understand it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="bg-hero min-h-[calc(100vh-80px)]">
      <section className="mx-auto max-w-[1440px] px-6 pb-16 pt-14 md:px-10 md:pb-20 md:pt-20">
        <div className="animate-rise border-t border-foreground pt-5">
          <h1 className="max-w-6xl text-[clamp(3.25rem,7.3vw,7rem)] font-medium leading-[0.92] tracking-[-0.06em]">
            Learn by teaching.
            <br />
            Prove you understand it<span className="text-brand">.</span>
          </h1>
        </div>

        <div className="mt-12 grid max-w-5xl gap-5 md:mt-16 md:grid-cols-2">
          <RoleCard to="/lecturer/dashboard" tone="ink" label="Teacher" dot="bg-brand" title="Upload your module. See exactly where every student stands." delay={120} />
          <RoleCard to="/student" tone="brand" label="Student" dot="bg-ink" title="Pick a topic, teach it out loud, and find out what you've really mastered." delay={220} />
        </div>
      </section>
    </main>
  );
}

function RoleCard({ to, tone, label, dot, title, delay }: { to: "/lecturer/dashboard" | "/student"; tone: "ink" | "brand"; label: string; dot: string; title: string; delay: number }) {
  return (
    <Link
      to={to}
      className={`animate-rise group relative flex h-[270px] flex-col justify-between overflow-hidden rounded-[24px] p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift md:h-[290px] md:p-8 ${tone === "ink" ? "bg-ink text-ink-foreground" : "bg-brand text-brand-foreground"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <span className="label-text inline-flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${dot}`} /> Enter as {label}
        </span>
        <span className={`grid h-11 w-11 place-items-center rounded-full transition-transform duration-300 group-hover:translate-x-1 ${tone === "ink" ? "bg-brand text-brand-foreground" : "bg-ink text-ink-foreground"}`}>
          <ArrowRight className="h-[18px] w-[18px]" />
        </span>
      </div>
      <h2 className="max-w-sm text-[28px] font-medium leading-[1.08] tracking-[-0.04em] md:text-[32px]">{title}</h2>
    </Link>
  );
}
