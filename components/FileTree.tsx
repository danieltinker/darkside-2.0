"use client";

import { useState } from "react";
import type { FsNode, FsKind } from "@/lib/filesystem";

// Glyph + tone per file kind. Dirs render a caret instead.
const GLYPH: Record<Exclude<FsKind, "dir">, string> = {
  apk: "▣",
  source: "ƒ",
  native: "⬡",
  json: "{}",
  frida: "≡",
  http: "⇄",
  screenshot: "▤",
  payload: "⬇",
  proc: "⚙",
};

const TONE: Record<Exclude<FsKind, "dir">, string> = {
  apk: "text-accent-amber",
  source: "text-ink-secondary",
  native: "text-accent-violet",
  json: "text-accent-cyan",
  frida: "text-accent-green",
  http: "text-accent-cyan",
  screenshot: "text-accent-violet",
  payload: "text-accent-red",
  proc: "text-ink-muted",
};

function Row({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: FsNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const isDir = !!node.children;
  const [open, setOpen] = useState(true);
  const isSelected = selected === node.path;
  const selectable = !isDir && node.present;

  const pad = { paddingLeft: `${depth * 14 + 8}px` };

  return (
    <>
      <button
        type="button"
        disabled={!isDir && !node.present}
        onClick={() => (isDir ? setOpen((o) => !o) : onSelect(node.path))}
        style={pad}
        className={`group flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left transition-colors ${
          isSelected
            ? "bg-bg-raised ring-1 ring-edge-strong"
            : selectable || isDir
              ? "hover:bg-bg-hover/60"
              : "cursor-default"
        }`}
      >
        <span className="w-3 shrink-0 text-center font-mono text-[11px] text-ink-faint">
          {isDir ? (open ? "▾" : "▸") : (
            <span className={node.present ? TONE[node.kind as Exclude<FsKind, "dir">] : "text-ink-faint"}>
              {GLYPH[node.kind as Exclude<FsKind, "dir">]}
            </span>
          )}
        </span>
        <span
          className={`flex-1 truncate font-mono text-[12px] ${
            isDir
              ? "font-medium text-ink-primary"
              : node.present
                ? "text-ink-secondary group-hover:text-ink-primary"
                : "text-ink-faint line-through decoration-edge"
          }`}
        >
          {node.name}
        </span>
        {node.meta && (
          <span
            className={`shrink-0 font-mono text-[10px] ${
              node.meta === "ACTIVE"
                ? "text-accent-green"
                : node.meta === "INERT" || node.meta === "empty" || node.meta === "awaiting run" || node.meta === "not running"
                  ? "text-ink-faint"
                  : "text-ink-muted"
            }`}
          >
            {node.meta}
          </span>
        )}
        {!isDir && !node.present && (
          <span className="shrink-0 rounded border border-edge px-1 font-mono text-[9px] uppercase text-ink-faint">
            pending
          </span>
        )}
      </button>
      {isDir &&
        open &&
        node.children!.map((c) => (
          <Row key={c.path} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} />
        ))}
    </>
  );
}

export function FileTree({
  root,
  selected,
  onSelect,
}: {
  root: FsNode;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  return (
    <div className="py-1">
      <Row node={root} depth={0} selected={selected} onSelect={onSelect} />
    </div>
  );
}
