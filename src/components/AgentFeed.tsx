"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Check, LoaderCircle, TriangleAlert, X } from "lucide-react";
import type { FeedItem } from "@/lib/useRoadie";
import { cn } from "@/lib/utils";
import { LogoMark } from "./Logo";
import { Markdown } from "./Markdown";
import { Button } from "./ui/button";

const SUGGESTIONS = [
  "Swap the weakest city for a better one nearby",
  "Draft a booking email to the venue in stop 1",
  "Write an Instagram announcement for the tour",
  "Which brand should we pitch first, and why?",
];

const enter = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
};

const isStep = (it?: FeedItem) => it?.kind === "tool" || it?.kind === "thought";

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
      <div ref={listRef} className="scroll-thin -mr-2 min-h-0 flex-1 overflow-y-auto pr-2" aria-live="polite">
        <ol className="space-y-3 py-1">
          {feed.map((it, i) => {
            // Consecutive tool calls and thoughts read as one timeline, joined by a rail.
            const rail = isStep(it) && isStep(feed[i + 1]) && <span aria-hidden className="absolute top-7 -bottom-3 left-[11px] w-px bg-white/10" />;

            if (it.kind === "tool")
              return (
                <motion.li key={i} {...enter} className="relative flex gap-3">
                  {rail}
                  <span
                    className={cn(
                      "relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border",
                      it.status === "running" && "border-primary/40 bg-primary/10 text-primary",
                      it.status === "ok" && "border-teal-400/30 bg-teal-400/10 text-teal-300",
                      it.status === "fail" && "border-rose-400/30 bg-rose-400/10 text-rose-300",
                    )}
                  >
                    {it.status === "running" ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : it.status === "ok" ? (
                      <Check className="size-3.5" />
                    ) : (
                      <X className="size-3.5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[13px] leading-snug font-medium", it.status === "running" && "shimmer-text")}>{it.label}</p>
                    {it.summary && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{it.summary}</p>}
                  </div>
                </motion.li>
              );

            if (it.kind === "thought")
              return (
                <motion.li key={i} {...enter} className="relative flex gap-3">
                  {rail}
                  <span aria-hidden className="relative grid size-6 shrink-0 place-items-center">
                    <span className="size-1.5 rounded-full bg-white/30" />
                  </span>
                  <details className="group min-w-0 flex-1 pt-0.5 text-[13px] leading-relaxed text-muted-foreground italic">
                    <summary className="line-clamp-3 cursor-pointer list-none group-open:line-clamp-none">{it.text}</summary>
                  </details>
                </motion.li>
              );

            if (it.kind === "error")
              return (
                <motion.li key={i} {...enter} className="flex gap-2.5 rounded-xl border border-rose-400/25 bg-rose-400/8 px-3 py-2.5 text-[13px] text-rose-100">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-300" /> {it.text}
                </motion.li>
              );

            return it.role === "user" ? (
              <motion.li key={i} {...enter} className="flex justify-end pl-8">
                <div className="rounded-2xl rounded-br-md border border-primary/20 bg-primary/12 px-3.5 py-2 text-sm">{it.text}</div>
              </motion.li>
            ) : (
              <motion.li key={i} {...enter}>
                <Reply text={it.text} />
              </motion.li>
            );
          })}

          {live && (
            <li>
              <Reply text={live} streaming />
            </li>
          )}
          {running && !live && (
            <li className="flex items-center gap-2.5 pl-1.5 text-xs">
              <span className="flex gap-1" aria-hidden>
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    className="size-1.5 rounded-full bg-primary"
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.18 }}
                  />
                ))}
              </span>
              <span className="shimmer-text font-medium">Roadie is working…</span>
            </li>
          )}
        </ol>
      </div>

      {canChat && (
        <div className="no-print mt-3 space-y-2.5 border-t border-white/6 pt-3">
          {!running && (
            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-24px),transparent)]">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="shrink-0 cursor-pointer rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
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
            className="flex items-center gap-2 rounded-2xl border border-input bg-black/25 p-1.5 pl-3.5 transition focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask Roadie to change or write something…"
              aria-label="Message Roadie"
              maxLength={1000}
              className="h-9 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70 sm:text-sm"
            />
            <Button size="icon-sm" disabled={running || !draft.trim()} aria-label="Send">
              <ArrowUp />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function Reply({ text, streaming }: { text: string; streaming?: boolean }) {
  return (
    <div className="surface rounded-2xl rounded-tl-md p-3.5">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium">
        <LogoMark className="size-5" /> Roadie
        {streaming && <span className="shimmer-text font-normal">typing</span>}
      </div>
      <Markdown text={text} />
    </div>
  );
}
