"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  HumanReview,
  MissionContext,
  EvidenceReturn,
  NodeConfirmation,
  Verdict,
} from "./contract";
import type { ArtifactContent } from "./mock";
import { MISSION_ID } from "./mock";

// =====================================================================
// Client side of the REAL filesystem PixelBridge.
//
// Each machine's dashboard renders from its OWN bridge mailbox on disk,
// fetched over /api/bridge/state and polled. The transport across the airgap
// is a single bundle file: export = download, import = upload. There is no
// shared client state between machines — that is the whole point.
//
// The human review (per-node confirm / verdict flip) is Yoda-local analyst
// judgment; it never crosses the airgap, so it stays in client state.
// =====================================================================

export type Role = "yoda" | "vader";

export type BridgeStateDTO = {
  role: Role;
  mission: MissionContext | null;
  missionInOutbox: boolean;
  evidence: EvidenceReturn | null;
  evidenceInOutbox: boolean;
  artifactContent: Record<string, ArtifactContent>;
};

export type ImportResultDTO = {
  ok: boolean;
  kind: "mission" | "evidence";
  mission_id: string;
  checksum_ok: boolean;
  artifacts_written: number;
  artifacts_verified: number;
  errors: string[];
};

const POLL_MS = 2500;

// ---- server-state hook (one machine's mailbox, polled) -------------
export function useBridge(role: Role, missionId: string = MISSION_ID) {
  const [data, setData] = useState<BridgeStateDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/bridge/state?role=${role}&id=${missionId}`, {
      cache: "no-store",
    });
    if (res.ok) setData((await res.json()) as BridgeStateDTO);
  }, [role, missionId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // ---- actions ----
  const produceMission = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/bridge/mission", { method: "POST" });
      await refresh();
      setNote("Mission staged to bridge/yoda_outbox");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const produceEvidence = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/bridge/evidence", { method: "POST" });
      const j = await res.json();
      await refresh();
      setNote(`Evidence materialized — ${j.artifactCount} real artifact files written`);
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const exportBundle = useCallback(
    (kind: "mission" | "evidence") => {
      const a = document.createElement("a");
      a.href = `/api/bridge/export?kind=${kind}&id=${missionId}`;
      a.download = `darkbridge-${kind}-${missionId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setNote(`Exported ${kind} bundle — carry it on the device to the other machine`);
    },
    [missionId],
  );

  const importFile = useCallback(
    async (file: File): Promise<ImportResultDTO | null> => {
      setBusy(true);
      try {
        const form = new FormData();
        form.append("bundle", file);
        const res = await fetch("/api/bridge/import", { method: "POST", body: form });
        const result = (await res.json()) as ImportResultDTO;
        await refresh();
        setNote(
          result.ok
            ? `Imported ${result.kind} — checksum ok, ${result.artifacts_verified}/${result.artifacts_written} artifacts verified`
            : `Import failed: ${result.errors.join("; ")}`,
        );
        return result;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const reset = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/bridge/reset", { method: "POST" });
      humanStore.reset();
      await refresh();
      setNote("Bridge wiped");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return {
    data,
    busy,
    note,
    refresh,
    produceMission,
    produceEvidence,
    exportBundle,
    importFile,
    reset,
  };
}

// =====================================================================
// Human review — Yoda-local, client-only (does not cross the airgap).
// =====================================================================
type HumanState = { human?: HumanReview };
let humanState: HumanState = {};
const listeners = new Set<() => void>();

function emit() {
  humanState = { ...humanState };
  listeners.forEach((l) => l());
}
function ensureHuman(): HumanReview {
  return (
    humanState.human ?? {
      reviewer: "analyst",
      trace_confirmed: false,
      node_confirmations: {},
      at: new Date().toISOString(),
    }
  );
}

export const humanStore = {
  get: () => humanState,
  setNodeConfirmation(nodeId: string, call: NodeConfirmation | null) {
    const h = ensureHuman();
    const node_confirmations = { ...h.node_confirmations };
    if (call === null) delete node_confirmations[nodeId];
    else node_confirmations[nodeId] = call;
    humanState = { human: { ...h, node_confirmations, at: new Date().toISOString() } };
    emit();
  },
  flipVerdict(verdict: Verdict, reason?: string) {
    const h = ensureHuman();
    humanState = {
      human: {
        ...h,
        verdict_override: verdict,
        trace_confirmed: verdict === "confirmed_tp",
        reason,
        at: new Date().toISOString(),
      },
    };
    emit();
  },
  clearHuman() {
    humanState = {};
    emit();
  },
  reset() {
    humanState = {};
    emit();
  },
};

export function useHuman(): HumanReview | undefined {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => humanState.human,
    () => undefined,
  );
}

// File-input helper: a hidden <input type=file> the Import button triggers.
export function useFilePicker(onPick: (file: File) => void) {
  const ref = useRef<HTMLInputElement | null>(null);
  const open = useCallback(() => ref.current?.click(), []);
  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) onPick(f);
      e.target.value = "";
    },
    [onPick],
  );
  return { ref, open, onChange };
}
