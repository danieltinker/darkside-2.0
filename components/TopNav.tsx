import Link from "next/link";

const LINKS = [
  { href: "/", label: "Overview", key: "home" },
  { href: "/queue", label: "Queue", key: "queue" },
  { href: "/yoda", label: "Yoda", key: "yoda" },
  { href: "/vader", label: "Vader", key: "vader" },
  { href: "/bridge", label: "Bridge", key: "bridge" },
  { href: "/diagnostics", label: "Diagnostics", key: "diagnostics" },
] as const;

export function TopNav({
  active,
}: {
  active: "home" | "queue" | "yoda" | "vader" | "bridge" | "diagnostics";
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-bg-base/85 backdrop-blur">
      {/* Wraps to a second line on narrow/zoomed screens instead of clipping the tabs. */}
      <div className="flex min-h-12 w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 px-6 py-1.5 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent-green shadow-glow" />
          <span className="font-mono text-[13px] font-semibold tracking-wide text-ink-primary">
            darkside
          </span>
          <span className="hidden font-mono text-[11px] text-ink-faint sm:inline">
            / mmp-uncloaking
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              className={`rounded-md px-2.5 py-1 font-mono text-[12px] transition-colors ${
                active === l.key
                  ? "bg-bg-raised text-ink-primary"
                  : "text-ink-muted hover:text-ink-secondary"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
