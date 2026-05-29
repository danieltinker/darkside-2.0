import { TopNav } from "@/components/TopNav";

export default function VaderPage() {
  return (
    <div className="min-h-screen">
      <TopNav active="vader" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-vader">
          Darth Vader · dynamic lab
        </p>
        <h1 className="mt-1 text-xl font-semibold text-ink-primary">Dynamic console</h1>
        <p className="mt-2 text-[13px] text-ink-secondary">
          Receive the mission, run the app, attach evidence per node. Built in
          Phase 5.
        </p>
      </main>
    </div>
  );
}
