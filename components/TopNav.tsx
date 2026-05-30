import Link from "next/link";

const LINKS = [
  { href: "/", label: "Overview", key: "home" },
  { href: "/queue", label: "Queue · cases", key: "queue" },
  { href: "/yoda", label: "Yoda · static", key: "yoda" },
  { href: "/vader", label: "Vader · dynamic", key: "vader" },
  { href: "/bridge", label: "PixelBridge · fs", key: "bridge" },
] as const;

export function TopNav({ active }: { active: "home" | "queue" | "yoda" | "vader" | "bridge" }) {
  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-bg-base/85 backdrop-blur">
      <div className="flex h-12 w-full items-center justify-between gap-3 overflow-x-auto px-6 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent-green shadow-glow" />
          <span className="font-mono text-[13px] font-semibold tracking-wide text-ink-primary">
            darkside
          </span>
          <span className="font-mono text-[11px] text-ink-faint">/ mmp-uncloaking</span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1">
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
