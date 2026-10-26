"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, Database, Printer } from "lucide-react";
import { useRoadie } from "@/lib/useRoadie";
import { PRESETS, nextMonthStart } from "./BriefForm";
import { Landing } from "./Landing";
import { Logo } from "./Logo";
import { AgentFeed } from "./AgentFeed";
import { Audience, Itinerary, MarketScan, Partners, Receipts } from "./panels";

const TourMap = dynamic(() => import("./TourMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-panel" />,
});

const TABS = ["Tour", "Audience", "Partners", "Market scan", "Receipts"] as const;
type Tab = (typeof TABS)[number];

export default function RoadieApp() {
  const r = useRoadie();
  const [tab, setTab] = useState<Tab>("Tour");
  const [focus, setFocus] = useState<string | undefined>();
  const [env, setEnv] = useState<{ qloo: string; llm: string | null } | null>(null);

  const { start } = r;
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    // Deep link: /?try=0 runs a preset immediately (handy for judges and demos).
    // Number(null) is 0, so a missing param must be ruled out first or every visit runs preset 0.
    const raw = new URLSearchParams(window.location.search).get("try");
    const n = raw === null || raw === "" ? NaN : Number(raw);
    const preset = Number.isInteger(n) ? PRESETS[n] : undefined;
    if (!preset) return;
    start({ ...preset.brief, startDate: nextMonthStart() });
  }, [start]);

  useEffect(() => {
    fetch("/api/status")
      .then((x) => x.json())
      .then(setEnv)
      .catch(() => {});
  }, []);

  const focusCity = (city?: string) => {
    setFocus(city);
    if (city) setTab((t) => (t === "Market scan" ? t : "Tour"));
  };

  if (!r.brief) return <Landing env={env} onStart={r.start} />;

  const mock = r.status.mock ?? (env ? env.qloo === "mock" : undefined);
  const calls = r.calls.length;

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden lg:h-screen">
      <header className="no-print flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
        <button onClick={r.reset} className="flex items-center gap-2 text-muted hover:text-text" aria-label="New tour">
          <ArrowLeft size={16} />
          <Logo />
        </button>
        <span className="hidden text-sm text-muted sm:inline">/</span>
        {r.board.act?.found?.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.board.act.found.image} alt="" className="h-7 w-7 rounded-full object-cover" />
        )}
        <span className="truncate text-sm font-medium">{r.brief.actName}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          {mock !== undefined && (
            <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${mock ? "border-pink/50 text-pink" : "border-teal/50 text-teal"}`}>
              <Database size={12} /> {mock ? "Demo data (no Qloo key)" : "Live Qloo"} · {calls} calls
            </span>
          )}
          {r.status.mode && (
            <span className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-muted">
              <Bot size={12} /> {r.status.mode === "agent" ? `Agent · ${r.status.model}` : "Autopilot"}
            </span>
          )}
          <button
            onClick={() => window.print()}
            disabled={!r.board.stops.length}
            className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-muted hover:text-text disabled:opacity-40"
          >
            <Printer size={12} /> Tour sheet
          </button>
        </div>
      </header>

      <div className="no-print grid min-h-0 flex-1 lg:grid-cols-[400px_1fr]">
        <aside className="no-print order-2 flex h-[70vh] min-w-0 flex-col border-t border-line p-4 lg:order-1 lg:h-auto lg:min-h-0 lg:border-r lg:border-t-0">
          <h2 className="mb-3 text-xs uppercase tracking-widest text-muted">Agent activity</h2>
          <AgentFeed feed={r.feed} running={r.running} live={r.live} onAsk={r.ask} canChat={!r.running || r.feed.length > 0} />
        </aside>

        <main className="order-1 flex min-h-0 min-w-0 flex-col lg:order-2">
          <div className="no-print h-[300px] shrink-0 border-b border-line lg:h-[42%]">
            <TourMap board={r.board} focusCity={focus} />
          </div>
          <nav className="no-print flex gap-1 overflow-x-auto border-b border-line px-3" role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition ${
                  tab === t ? "border-amber text-text" : "border-transparent text-muted hover:text-text"
                }`}
              >
                {t}
                {t === "Receipts" && calls > 0 && <span className="ml-1.5 rounded bg-panel-2 px-1.5 text-xs">{calls}</span>}
              </button>
            ))}
          </nav>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "Tour" && <Itinerary board={r.board} focus={focus} onFocus={focusCity} onAsk={r.running ? undefined : r.ask} />}
            {tab === "Audience" && <Audience board={r.board} />}
            {tab === "Partners" && <Partners board={r.board} />}
            {tab === "Market scan" && <MarketScan board={r.board} onFocus={focusCity} />}
            {tab === "Receipts" && <Receipts calls={r.calls} />}
          </div>
        </main>
      </div>

      <div className="print-only space-y-6 p-6">
        <h1 className="font-display text-3xl uppercase">{r.brief.actName}: tour sheet</h1>
        <Itinerary board={r.board} onFocus={() => {}} />
        <Partners board={r.board} />
        <Audience board={r.board} />
        <p className="text-xs">Planned with Roadie using Qloo taste data. Affinity reflects aggregate audience taste, not ticket demand.</p>
      </div>
    </div>
  );
}
