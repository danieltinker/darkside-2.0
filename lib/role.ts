// Machine role — pinned per deployment via NEXT_PUBLIC_DARKSIDE_ROLE (set in each
// role-zip's .env). Unset = "both" (single-machine dev). Inlined at build time,
// so it's available on both server and client. Drives nav gating + the role banner.

export type Role = "yoda" | "vader" | "both";

const raw = process.env.NEXT_PUBLIC_DARKSIDE_ROLE;
export const ROLE: Role = raw === "yoda" ? "yoda" : raw === "vader" ? "vader" : "both";

// Which nav tabs each role sees. Yoda owns static/queue/agent + reconcile on the
// bridge; Vader owns the dynamic run + bridge import/export. "both" sees all (dev).
export const VISIBLE_TABS: Record<Role, readonly string[]> = {
  both: ["home", "queue", "agent", "yoda", "vader", "bridge", "diagnostics"],
  yoda: ["home", "queue", "agent", "yoda", "bridge", "diagnostics"],
  vader: ["home", "vader", "bridge", "diagnostics"],
};

export const ROLE_LABEL: Record<Role, string> = {
  yoda: "Yoda machine",
  vader: "Vader machine",
  both: "dev · both roles",
};
