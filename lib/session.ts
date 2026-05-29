"use client";

import { useSyncExternalStore } from "react";
import type { HumanReview, MissionStatus } from "./contract";
import { missionContext, evidenceReturn } from "./mock";
import { sendMission as bridgeSendMission, sendEvidence as bridgeSendEvidence } from "./bridge";

// =====================================================================
// Client session store. Drives the one mission's lifecycle across soft
// navigation between /yoda and /vader. The PixelBridge (lib/bridge.ts) is
// the medium for the two contract messages; this store tracks the lifecycle
// status + human review and notifies subscribers. Resets on hard reload —
// honest about the no-DB constraint.
// =====================================================================

export type SessionState = {
  status: MissionStatus;
  missionSent: boolean;
  evidenceReturned: boolean;
  human?: HumanReview;
};

const INITIAL: SessionState = {
  status: "STATIC_CONFIRMED",
  missionSent: false,
  evidenceReturned: false,
};

let state: SessionState = INITIAL;
const listeners = new Set<() => void>();

function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot() {
  return state;
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getSnapshot, () => INITIAL);
}

export const session = {
  get: () => state,

  // Yoda → Vader
  sendMission() {
    bridgeSendMission(missionContext);
    state = { ...state, status: "MISSION_SENT", missionSent: true };
    emit();
  },

  // Vader side
  receiveMission() {
    if (state.status === "MISSION_SENT") {
      state = { ...state, status: "RECEIVED" };
      emit();
    }
  },
  runDynamic() {
    state = { ...state, status: "DYNAMIC_RUNNING" };
    emit();
  },
  sendEvidence() {
    bridgeSendEvidence(evidenceReturn);
    state = { ...state, status: "EVIDENCE_SENT", evidenceReturned: true };
    emit();
  },

  // Yoda reconcile / human-in-the-loop
  applyHuman(human: HumanReview) {
    state = { ...state, human, status: "SCORED" };
    emit();
  },
  clearHuman() {
    state = { ...state, human: undefined, status: "EVIDENCE_SENT" };
    emit();
  },

  reset() {
    state = { ...INITIAL };
    emit();
  },
};
