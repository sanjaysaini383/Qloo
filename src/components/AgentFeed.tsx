"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Send, Sparkles, X } from "lucide-react";
import type { FeedItem } from "@/lib/useRoadie";
import { Markdown } from "./Markdown";

const SUGGESTIONS = [
  "Swap the weakest city for a better one nearby",
  "Draft a booking email to the venue in stop 1",
  "Write an Instagram announcement for the tour",
  "Which brand should we pitch first, and why?",
];

export function AgentFeed({
  feed,
  running,
  live,
  onAsk,
  canChat,
}: {
  feed: FeedItem[];
  running: boolean;
  live?: string;
  onAsk: (q: string) => void;
  canChat: boolean;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [feed.length, running, live]);

  const send = (q: string) => {
    if (!q.trim() || running) return;
    onAsk(q.trim());
    setDraft("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" aria-live="polite">
        {feed.map((it, i) => {
          if (it.kind === "tool")
            return (
              <div key={i} className="flex gap-2.5 rounded-lg border border-line/70 bg-ink/40 px-3 py-2">
                <span className="mt-0.5 shrink-0">
                  {it.status === "running" ? (
                    <Loader2 size={15} className="animate-spin text-amber" />
                  ) : it.status === "ok" ? (
                    <Check size={15} className="text-teal" />
                  ) : (
                    <X size={15} className="text-pink" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="text-sm">{it.label}</div>
                  {it.summary && <div className="truncate text-xs text-muted">{it.summary}</div>}
                </div>
              </div>
            );
          if (it.kind === "thought")
            return (
              <details key={i} className="group px-1 text-sm italic text-muted">
                <summary className="line-clamp-3 cursor-pointer list-none group-open:line-clamp-none">{it.text}</summary>
              </details>
            );
          if (it.kind === "error")
            return (
              <div key={i} className="flex gap-2 rounded-lg border border-pink/40 bg-pink/10 px-3 py-2 text-sm">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-pink" /> {it.text}
              </div>
            );
          return it.role === "user" ? (
            <div key={i} className="ml-8 rounded-xl rounded-br-sm bg-amber/15 px-3 py-2 text-sm">
              {it.text}
            </div>
          ) : (
            <div key={i} className="rounded-xl rounded-bl-sm border border-amber/30 bg-panel-2 px-3.5 py-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-widest text-amber">
                <Sparkles size={12} /> Roadie
              </div>
              <Markdown text={it.text} />
            </div>
          );
        })}
        {live && (
          <div className="rounded-xl rounded-bl-sm border border-amber/30 bg-panel-2 px-3.5 py-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-widest text-amber">
              <Sparkles size={12} /> Roadie
            </div>
            <Markdown text={live} />
          </div>
        )}
        {running && !live && (
          <div className="flex items-center gap-2 px-1 text-xs text-muted">
            <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-amber" /> Roadie is working…
          </div>
        )}
      </div>

      {canChat && (
        <div className="no-print mt-3 space-y-2 border-t border-line pt-3">
          {!running && (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-amber hover:text-amber"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask Roadie to change or write something…"
              maxLength={1000}
              className="flex-1 rounded-lg border border-line bg-ink/60 px-3 py-2 text-sm outline-none focus:border-amber"
            />
            <button
              disabled={running || !draft.trim()}
              aria-label="Send"
              className="rounded-lg bg-amber px-3 text-ink disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
