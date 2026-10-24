"use client";
import { useCallback, useRef, useState } from "react";
import { emptyBoard, type AgentEvent, type Board, type Brief, type QlooCallView } from "./types";

export type FeedItem =
  | { kind: "tool"; id: string; name: string; label: string; status: "running" | "ok" | "fail"; summary?: string }
  | { kind: "thought"; text: string }
  | { kind: "message"; role: "user" | "assistant"; text: string }
  | { kind: "error"; text: string };

export interface RunStatus {
  mode?: "agent" | "autopilot";
  mock?: boolean;
  model?: string;
}

export function useRoadie() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [board, setBoard] = useState<Board>(emptyBoard());
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [calls, setCalls] = useState<QlooCallView[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<RunStatus>({});
  const abortRef = useRef<AbortController | null>(null);
  const boardRef = useRef<Board>(board);

  const handle = useCallback((e: AgentEvent) => {
    switch (e.type) {
      case "status":
        setStatus({ mode: e.mode, mock: e.mock, model: e.model });
        break;
      case "thought":
        setFeed((f) => [...f, { kind: "thought", text: e.text }]);
        break;
      case "tool":
        setFeed((f) => [...f, { kind: "tool", id: e.id, name: e.name, label: e.label, status: "running" }]);
        break;
      case "tool_done":
        setFeed((f) =>
          f.map((it) =>
            it.kind === "tool" && it.id === e.id ? { ...it, status: e.ok ? "ok" : "fail", summary: e.summary } : it,
          ),
        );
        break;
      case "qloo":
        setCalls((c) => [...c, { ...e.call, id: c.length + 1 }]);
        break;
      case "board":
        boardRef.current = e.board;
        setBoard(e.board);
        break;
      case "message":
        setFeed((f) => [...f, { kind: "message", role: "assistant", text: e.text }]);
        break;
      case "error":
        setFeed((f) => [...f, { kind: "error", text: e.text }]);
        break;
    }
  }, []);

  const stream = useCallback(
    async (payload: Record<string, unknown>) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setRunning(true);
      try {
        const res = await fetch("/api/plan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
          handle({ type: "error", text: err.error ?? `Request failed (${res.status})` });
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (line) {
              try {
                handle(JSON.parse(line) as AgentEvent);
              } catch {
                /* ignore partial line */
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") handle({ type: "error", text: "Connection lost. Please try again." });
      } finally {
        if (abortRef.current === ctrl) setRunning(false);
      }
    },
    [handle],
  );

  const start = useCallback(
    (b: Brief) => {
      setBrief(b);
      const fresh = emptyBoard();
      boardRef.current = fresh;
      setBoard(fresh);
      setCalls([]);
      setFeed([]);
      void stream({ brief: b });
    },
    [stream],
  );

  const ask = useCallback(
    (message: string) => {
      if (!brief) return;
      const history = feed
        .filter((f): f is Extract<FeedItem, { kind: "message" }> => f.kind === "message")
        .map((m) => ({ role: m.role, text: m.text.slice(0, 6000) }))
        .slice(-10);
      setFeed((f) => [...f, { kind: "message", role: "user", text: message }]);
      void stream({ brief, message, history, board: boardRef.current });
    },
    [brief, feed, stream],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setBrief(null);
    setBoard(emptyBoard());
    setFeed([]);
    setCalls([]);
    setStatus({});
  }, []);

  return { brief, board, feed, calls, running, status, start, ask, reset };
}
