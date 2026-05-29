import type { KnownRiskwareUrl } from "./contract";

// =====================================================================
// Known-riskware-URL DB — self-maintaining O(1) cache on Yoda.
//
// The node that produces_url yields the affiliate URL; check it against the
// DB for an O(1) hit. On a confirmed_tp verdict, write the found URLs back so
// the corpus grows — new URLs become future O(1) hits. MVP backing store is
// an in-process Map keyed by normalized URL AND domain (a real build swaps
// the same interface for Redis/KV with O(1) preserved).
// =====================================================================

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    return u.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return raw.trim().replace(/\/$/, "").toLowerCase();
  }
}

export function domainOf(raw: string): string {
  try {
    return new URL(raw.trim()).hostname.toLowerCase();
  } catch {
    return raw
      .trim()
      .toLowerCase()
      .replace(/^[a-z]+:\/\//, "")
      .split("/")[0]
      .split("?")[0];
  }
}

// Module-level singleton store. Two indices → O(1) by url and by domain.
const byUrl = new Map<string, KnownRiskwareUrl>();
const byDomain = new Map<string, KnownRiskwareUrl[]>();

function indexEntry(e: KnownRiskwareUrl) {
  byUrl.set(e.url, e);
  const list = byDomain.get(e.domain) ?? [];
  if (!list.includes(e)) list.push(e);
  byDomain.set(e.domain, list);
}

// Idempotent seed (safe across hot reloads): upsert by normalized url.
export function seedKnownUrls(entries: KnownRiskwareUrl[]): void {
  for (const raw of entries) {
    const url = normalizeUrl(raw.url);
    const domain = raw.domain || domainOf(raw.url);
    const existing = byUrl.get(url);
    if (existing) {
      existing.hits = Math.max(existing.hits, raw.hits);
      continue;
    }
    indexEntry({ ...raw, url, domain });
  }
}

export type UrlLookup = { known: boolean; entry?: KnownRiskwareUrl };

export function lookupUrl(url: string): UrlLookup {
  const entry = byUrl.get(normalizeUrl(url));
  return entry ? { known: true, entry } : { known: false };
}

export type DomainLookup = { known: boolean; entries: KnownRiskwareUrl[] };

export function lookupDomain(domain: string): DomainLookup {
  const entries = byDomain.get(domain.toLowerCase()) ?? [];
  return { known: entries.length > 0, entries };
}

export type RecordResult = { entry: KnownRiskwareUrl; added: boolean };

// Write-back on confirmed_tp. Re-observation bumps hits; a new URL is added
// and becomes a future O(1) hit.
export function recordTp(
  url: string,
  domain: string,
  mission_id: string,
  package_name: string,
): RecordResult {
  const key = normalizeUrl(url);
  const dom = (domain || domainOf(url)).toLowerCase();
  const existing = byUrl.get(key);
  if (existing) {
    existing.hits += 1;
    return { entry: existing, added: false };
  }
  const entry: KnownRiskwareUrl = {
    url: key,
    domain: dom,
    first_seen_mission_id: mission_id,
    package_name,
    added_at: new Date().toISOString(),
    hits: 1,
  };
  indexEntry(entry);
  return { entry, added: true };
}

// Write back every found URL for a TP case. Returns how many were newly added.
export function recordTpMany(
  urls: string[],
  mission_id: string,
  package_name: string,
): { addedCount: number; results: RecordResult[] } {
  const results = urls.map((u) =>
    recordTp(u, domainOf(u), mission_id, package_name),
  );
  return { addedCount: results.filter((r) => r.added).length, results };
}

export function snapshot(): KnownRiskwareUrl[] {
  return Array.from(byUrl.values());
}
