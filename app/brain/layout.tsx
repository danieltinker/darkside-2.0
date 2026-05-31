import type { ReactNode } from "react";

// Standalone, full-bleed shell — deliberately NOT importing TopNav. This window
// is reached only by navigating to /brain and is invisible from the product tabs.
export default function BrainLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen w-screen bg-bg-base text-zinc-100">{children}</div>;
}
