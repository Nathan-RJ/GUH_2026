import { Link, useRouterState } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <circle cx="24" cy="5" r="3" fill="var(--brand)" />
      <path d="M6 14 L16 8 L20 16 L12 22 L8 30 M20 16 L27 20 M16 8 L22 6" fill="none" stroke="var(--brand)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const linkCls = "relative px-0.5 py-2 label-text text-foreground/60 transition-colors hover:text-foreground";
const activeCls = "text-foreground after:absolute after:inset-x-0 after:-bottom-[13px] after:h-[3px] after:bg-brand md:after:-bottom-[25px]";

export function AppHeader() {
  const [dark, setDark] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const inTeacher = path.startsWith("/lecturer");
  const inStudent = path.startsWith("/student");

  useEffect(() => {
    const d = localStorage.getItem("r2m-theme") === "dark";
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
  }, []);
  const toggle = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    localStorage.setItem("r2m-theme", d ? "dark" : "light");
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-xl">
      <div className="flex flex-wrap items-center md:h-20 md:flex-nowrap md:pl-10">
        <div className="flex h-16 flex-1 items-center pl-5 md:h-20 md:pl-0">
          <Link to="/" className="flex shrink-0 items-center gap-1.5 text-xl font-bold uppercase tracking-[-0.045em] md:text-2xl">
            <Mark /> Reply <span className="text-brand">2</span> Me
          </Link>
        </div>
        <button onClick={toggle} aria-label="Toggle dark mode" className="order-2 grid h-16 w-16 place-items-center border-l bg-ink text-ink-foreground transition-colors hover:text-brand md:order-3 md:h-20 md:w-20">
          {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <nav className="order-3 flex h-11 w-full items-center justify-center gap-7 border-t md:order-2 md:mr-10 md:h-20 md:w-auto md:gap-8 md:border-t-0">
          {inTeacher && (
            <div className="hidden items-center gap-8 lg:flex">
              <Link to="/lecturer/dashboard" className={linkCls} activeProps={{ className: activeCls }}>Overview</Link>
              <Link to="/lecturer/upload" className={linkCls} activeProps={{ className: activeCls }}>Documents</Link>
              <span className="h-5 w-px bg-border" />
            </div>
          )}
          <Link to="/lecturer/dashboard" className={cn(linkCls, inTeacher && activeCls)}>Teacher</Link>
          <Link to="/student" className={cn(linkCls, inStudent && activeCls)}>Student</Link>
        </nav>
      </div>
    </header>
  );
}
