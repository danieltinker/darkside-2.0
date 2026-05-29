import type { Artifact } from "@/lib/contract";
import type {
  ArtifactContent,
  FridaContent,
  HttpContent,
  ShotContent,
} from "@/lib/mock";
import { StatusChip } from "./StatusChip";

// Renders one dynamic-evidence artifact from its stored content (mock: looked
// up by Artifact.path). Frida logs, HTTP request/response, and screenshots
// each get a purpose-built renderer.

function fridaLineTone(line: string): string {
  if (line.startsWith("[+]")) return "text-accent-green";
  if (line.startsWith("[Frida]")) return "text-ink-muted";
  if (line.includes("CONFIRMED ACTIVE")) return "text-accent-green";
  return "text-ink-secondary";
}

function FridaLog({ content }: { content: FridaContent }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-edge-faint bg-bg-void/80 p-3 font-mono text-[11.5px] leading-relaxed">
      {content.lines.map((line, i) => (
        <div key={i} className={fridaLineTone(line)}>
          {line}
        </div>
      ))}
    </pre>
  );
}

function HttpExchange({ content }: { content: HttpContent }) {
  return (
    <div className="overflow-hidden rounded-md border border-edge-faint bg-bg-void/80 font-mono text-[11.5px]">
      <div className="flex items-center gap-2 border-b border-edge-faint px-3 py-2">
        <span className="rounded bg-accent-cyan/15 px-1.5 py-0.5 font-semibold text-accent-cyan">
          {content.method}
        </span>
        <span className="truncate text-ink-secondary">{content.url}</span>
      </div>
      <div className="space-y-1 px-3 py-2 text-ink-muted">
        {Object.entries(content.reqHeaders).map(([k, v]) => (
          <div key={k}>
            <span className="text-ink-faint">{k}:</span> {v}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-y border-edge-faint bg-bg-panel/60 px-3 py-2">
        <span
          className={`font-semibold ${
            content.status < 400 ? "text-accent-green" : "text-accent-red"
          }`}
        >
          {content.status} {content.statusText}
        </span>
        {Object.entries(content.respHeaders).map(([k, v]) => (
          <span key={k} className="text-ink-muted">
            <span className="text-ink-faint">{k}:</span> {v}
          </span>
        ))}
      </div>
      <pre className="overflow-x-auto px-3 py-2 leading-relaxed text-ink-secondary">
        {highlightDl(content.respBody)}
      </pre>
    </div>
  );
}

// Highlight the cloaked "dl" field — the line that carries the wrapped URL.
function highlightDl(body: string) {
  return body.split("\n").map((line, i) => {
    const isDl = /"dl"\s*:/.test(line);
    return (
      <div
        key={i}
        className={isDl ? "rounded bg-accent-amber/10 text-accent-amber" : undefined}
      >
        {line}
      </div>
    );
  });
}

function Screenshot({ content }: { content: ShotContent }) {
  return (
    <figure className="overflow-hidden rounded-md border border-edge-faint bg-bg-void/80">
      {/* eslint-disable-next-line @next/next/no-img-element -- placeholder SVG artifact */}
      <img
        src={content.src}
        alt={content.caption}
        className="max-h-56 w-full object-cover object-top"
      />
      <figcaption className="border-t border-edge-faint px-3 py-1.5 font-mono text-[11px] text-ink-muted">
        {content.caption}
      </figcaption>
    </figure>
  );
}

const KIND_LABEL: Record<Artifact["kind"], string> = {
  frida: "Frida",
  http: "HTTP",
  screenshot: "Screenshot",
};

const KIND_TONE = {
  frida: "green",
  http: "cyan",
  screenshot: "violet",
} as const;

export function EvidenceViewer({
  artifact,
  content,
}: {
  artifact: Artifact;
  content: ArtifactContent | undefined;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusChip tone={KIND_TONE[artifact.kind]} label={KIND_LABEL[artifact.kind]} />
          <span className="font-mono text-[11px] text-ink-secondary">{artifact.label}</span>
        </div>
        <span
          className="font-mono text-[10px] text-ink-faint"
          title={`sha256:${artifact.sha256}`}
        >
          {artifact.sha256.slice(0, 10)}
        </span>
      </div>
      {!content ? (
        <div className="rounded-md border border-edge-faint bg-bg-void/60 p-3 font-mono text-[11px] text-ink-muted">
          artifact stored at {artifact.path}
        </div>
      ) : content.kind === "frida" ? (
        <FridaLog content={content} />
      ) : content.kind === "http" ? (
        <HttpExchange content={content} />
      ) : (
        <Screenshot content={content} />
      )}
    </div>
  );
}
