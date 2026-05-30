import type { ReactNode } from "react";
import type { ReconciledNode, UrlIntel } from "@/lib/reconcile";
import type { ArtifactContent } from "@/lib/mock";
import type { NodeKind } from "@/lib/contract";
import { StatusChip, DynamicStatusChip, type ChipTone } from "./StatusChip";
import { EvidenceViewer } from "./EvidenceViewer";
import { CopyButton } from "./CopyButton";
import { HookDialog } from "./HookDialog";
import { fridaHookScript } from "@/lib/frida";

const KIND_TONE: Record<NodeKind, ChipTone> = {
  trigger: "cyan",
  dispatch: "neutral",
  http: "cyan",
  parse: "violet",
  deobf: "amber",
  sink: "red",
  condition: "amber", // the cloaking gate
  benign_branch: "green", // decoy / harmless path
  assessment: "violet",
  verdict: "red",
};

function Decryptor({ rn }: { rn: ReconciledNode }) {
  const d = rn.node.decryptor;
  if (!d) return null;
  return (
    <div className="mt-3 rounded-md border border-accent-amber/25 bg-accent-amber/[0.04] p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <StatusChip tone="amber" label={`Decryptor · ${d.algorithm}`} />
        <span className="font-mono text-[10.5px] text-ink-muted">{d.key_source}</span>
      </div>
      <table className="w-full border-collapse font-mono text-[11px]">
        <thead>
          <tr className="text-left text-ink-faint">
            <th className="pb-1 font-medium">ciphertext</th>
            <th className="pb-1 font-medium" />
            <th className="pb-1 font-medium">plaintext</th>
          </tr>
        </thead>
        <tbody>
          {d.decrypted_strings.map((s) => (
            <tr key={s.ciphertext} className="align-top">
              <td className="max-w-[140px] truncate py-0.5 pr-2 text-ink-muted" title={s.ciphertext}>
                {s.ciphertext}
              </td>
              <td className="py-0.5 pr-2 text-ink-faint">→</td>
              <td className="break-all py-0.5 text-accent-green">{s.plaintext}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NativeFile({ rn }: { rn: ReconciledNode }) {
  const nf = rn.nativeFile;
  if (!nf) return null;
  return (
    <div className="mt-3 rounded-md border border-accent-violet/25 bg-accent-violet/[0.04] p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <StatusChip tone="violet" label={`Native · ${nf.name}`} />
        {nf.confirmed_active ? (
          <StatusChip tone="green" dot label="Native Active" />
        ) : (
          <StatusChip tone="neutral" label="Native Inert" />
        )}
      </div>
      <dl className="space-y-0.5 font-mono text-[10.5px] text-ink-muted">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-ink-faint">native_id</dt>
          <dd>{nf.native_id}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-ink-faint">sha256</dt>
          <dd className="break-all">{nf.sha256.slice(0, 24)}…</dd>
        </div>
        {nf.exported_symbol && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-ink-faint">export</dt>
            <dd className="break-all text-ink-secondary">{nf.exported_symbol}</dd>
          </div>
        )}
      </dl>
      <p className="mt-1.5 text-[10.5px] italic text-ink-muted">{nf.activity_note}</p>
    </div>
  );
}

function KnownUrlBadge({ intel }: { intel: UrlIntel }) {
  const strong = intel.urlKnown;
  const corroborated = intel.domainKnown;
  if (!strong && !corroborated) {
    return (
      <div className="mt-3 rounded-md border border-edge bg-bg-raised/60 p-2.5">
        <StatusChip tone="neutral" label="New URL" />
        <p className="mt-1 break-all font-mono text-[11px] text-ink-secondary">{intel.url}</p>
      </div>
    );
  }
  const totalHits = intel.domainEntries.reduce((s, e) => s + e.hits, 0) + (intel.urlEntry?.hits ?? 0);
  return (
    <div
      className={`mt-3 rounded-md border p-2.5 ${
        strong
          ? "border-accent-red/35 bg-accent-red/[0.06]"
          : "border-accent-amber/30 bg-accent-amber/[0.05]"
      }`}
    >
      <div className="flex items-center gap-2">
        <StatusChip
          tone={strong ? "red" : "amber"}
          dot
          label={strong ? "Known Riskware URL" : "Known Riskware Domain"}
        />
        <span className="font-mono text-[10.5px] text-ink-muted">
          {strong
            ? `${intel.urlEntry?.hits ?? 1} prior hits · first seen ${intel.urlEntry?.first_seen_mission_id}`
            : `${intel.domainEntries.length} prior on ${intel.domain} · ${totalHits} hits`}
        </span>
      </div>
      <p className="mt-1 break-all font-mono text-[11px] text-ink-secondary">{intel.url}</p>
    </div>
  );
}

function StaticColumn({ rn, urlIntel }: { rn: ReconciledNode; urlIntel?: UrlIntel }) {
  const sig = rn.node.signature;
  return (
    <div className="space-y-2 border-l-2 border-yoda/40 pl-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-yoda/80">
          Static · Yoda
        </span>
        {rn.node.static_confirmed ? (
          <StatusChip tone="green" label="Static Confirmed" />
        ) : (
          <StatusChip tone="neutral" label="Unconfirmed" />
        )}
      </div>
      {sig ? (
        <>
          <div className="font-mono text-[12px] text-ink-primary">
            <span className="text-ink-secondary">{sig.class_name}</span>
            <span className="text-ink-faint">.</span>
            {sig.method}
          </div>
          <div className="flex items-center gap-2 font-mono text-[10.5px] text-ink-muted">
            <span className="min-w-0 truncate">
              {sig.file_path}:{sig.line}
            </span>
            <CopyButton text={`${sig.file_path}:${sig.line}`} label="⧉ path" />
          </div>
          <pre className="overflow-x-auto rounded-md border border-edge-faint bg-bg-void/70 p-2.5 font-mono text-[11px] leading-relaxed text-ink-secondary">
            {sig.snippet}
          </pre>
        </>
      ) : (
        <div className="rounded-md border border-dashed border-edge bg-bg-void/40 p-2.5 font-mono text-[10.5px] text-ink-muted">
          role-level node — no per-app signature
        </div>
      )}
      <Decryptor rn={rn} />
      <NativeFile rn={rn} />
      {rn.node.produces_url && urlIntel && <KnownUrlBadge intel={urlIntel} />}
    </div>
  );
}

function DynamicColumn({
  rn,
  artifactContent,
}: {
  rn: ReconciledNode;
  artifactContent: Record<string, ArtifactContent>;
}) {
  const ev = rn.evidence;
  return (
    <div className="space-y-2 border-l-2 border-vader/40 pl-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-vader/80">
          Dynamic · Vader
        </span>
        <DynamicStatusChip status={rn.status} />
      </div>
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] text-ink-muted">
        <span className="min-w-0 truncate">
          <span className="text-ink-faint">frida_hook</span> {rn.node.frida_hook}
        </span>
        <CopyButton text={rn.node.frida_hook} label="⧉ hook" />
        <HookDialog
          title={`${rn.node.node_id} · ${rn.node.label}`}
          subtitle={rn.node.frida_hook}
          code={fridaHookScript(rn.node)}
        />
      </div>
      {!ev ? (
        <div className="rounded-md border border-dashed border-edge bg-bg-void/40 p-3 text-center font-mono text-[11px] text-ink-muted">
          awaiting dynamic evidence
        </div>
      ) : (
        <>
          {ev.artifacts.map((a) => (
            <EvidenceViewer key={a.path} artifact={a} content={artifactContent[a.path]} />
          ))}
          <p className="border-l border-edge pl-2 text-[11.5px] leading-snug text-ink-secondary">
            {ev.observation}
          </p>
        </>
      )}
    </div>
  );
}

export function NodeCard({
  rn,
  artifactContent,
  urlIntel,
  showDynamic = true,
  humanControls,
}: {
  rn: ReconciledNode;
  artifactContent: Record<string, ArtifactContent>;
  urlIntel?: UrlIntel;
  showDynamic?: boolean;
  humanControls?: ReactNode;
}) {
  const ringByStatus =
    rn.status === "confirmed"
      ? "shadow-card"
      : rn.status === "failed"
        ? "shadow-glow-red"
        : "";
  return (
    <div
      className={`rounded-xl border border-edge bg-bg-card/90 p-3.5 ${ringByStatus}`}
      id={rn.node.node_id}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10.5px] text-ink-faint">{rn.node.node_id}</span>
        <span className="text-[13px] font-semibold text-ink-primary">{rn.node.label}</span>
        <StatusChip tone={KIND_TONE[rn.node.kind]} label={rn.node.kind} />
        {rn.isRequired && (
          <StatusChip tone="neutral" label="Boundary · gates 8" title="Required node — gates the strong-8 score" />
        )}
      </div>
      <div className={`grid gap-4 ${showDynamic ? "md:grid-cols-2" : "grid-cols-1"}`}>
        <StaticColumn rn={rn} urlIntel={urlIntel} />
        {showDynamic && <DynamicColumn rn={rn} artifactContent={artifactContent} />}
      </div>
      {humanControls && <div className="mt-3 border-t border-edge-faint pt-3">{humanControls}</div>}
    </div>
  );
}
