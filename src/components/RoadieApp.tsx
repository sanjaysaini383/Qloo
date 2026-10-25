"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, Database, Printer } from "lucide-react";
import { useRoadie } from "@/lib/useRoadie";
import { BriefForm, PRESETS } from "./BriefForm";
import { AgentFeed } from "./AgentFeed";
import { Audience, Itinerary, MarketScan, Partners, Receipts } from "./panels";

const TourMap = dynamic(() => import("./TourMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-panel" />,
});

const TABS = ["Tour", "Audience", "Partners", "Market scan", "Receipts"] as const;
type Tab = (typeof TABS)[number];

const REPO = "https://github.com/sanjaysaini383/Qloo";

function Logo() {
  return (
    <span className="font-display text-2xl uppercase tracking-wider">
      Road<span className="text-amber">ie</span>
    </span>
  );
}

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
    const n = Number(new URLSearchParams(window.location.search).get("try"));
    const preset = Number.isInteger(n) ? PRESETS[n] : undefined;
    if (!preset) return;
    const d = new Date();
    d.setMonth(d.getMonth() + 2, 1);
    start({ ...preset.brief, startDate: d.toISOString().slice(0, 10) });
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
          <AgentFeed feed={r.feed} running={r.running} onAsk={r.ask} canChat={!r.running || r.feed.length > 0} />
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

function Landing({ env, onStart }: { env: { qloo: string; llm: string | null } | null; onStart: Parameters<typeof BriefForm>[0]["onSubmit"] }) {
  return (
    <div className="stage-glow min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <a href={REPO} className="text-sm text-muted hover:text-text" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </header>

      <section className="mx-auto grid max-w-6xl items-start gap-10 px-4 pb-16 pt-6 lg:grid-cols-[1.1fr_1fr] lg:pt-12">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-amber">AI tour manager · powered by Qloo taste AI</p>
          <h1 className="font-display text-5xl uppercase leading-[0.95] sm:text-6xl">
            Your fans are out there.
            <br />
            <span className="text-amber">Roadie knows where.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-text/80">
            Most independent acts book tours on gut feel and a spreadsheet. Roadie is an agent that reads Qloo&apos;s cultural taste graph to find the cities where your
            audience over-indexes, the venues and neighbourhoods they actually go to, support acts who share your fans, and the brands and podcasts worth pitching.
          </p>
          <ul className="mt-6 grid max-w-xl gap-3 text-sm sm:grid-cols-2">
            {[
              ["Market scan", "Every city in a region ranked by your fans' affinity."],
              ["City scouting", "Fan hotspot heatmaps, taste-matched venues, local hangouts."],
              ["Co-bills & partners", "Bookable support acts, brands and podcasts your fans love."],
              ["Routed itinerary", "Travel-optimised dates, angles per city, and an agent you can talk to."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-xl border border-line/70 bg-panel/60 p-3">
                <div className="font-semibold">{t}</div>
                <div className="text-muted">{d}</div>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-xl text-sm text-muted">
            <strong className="text-text">New act, not in any database yet?</strong> Tell Roadie who you sound like. It models your future fans through the acts they
            already love.
          </p>
        </div>

        <div>
          <BriefForm onSubmit={onStart} />
          {env && (
            <p className="mt-3 text-center text-xs text-muted">
              {env.qloo === "live" ? "Connected to live Qloo data" : "Running on fictional demo data (no Qloo key configured)"} ·{" "}
              {env.llm ? `Agent: ${env.llm}` : "Autopilot planner (no LLM key)"}
            </p>
          )}
        </div>
      </section>

      <section className="border-t border-line/60 bg-ink/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 lg:grid-cols-3">
          <div>
            <h2 className="font-display text-3xl uppercase">Why a plain LLM can&apos;t do this</h2>
            <p className="mt-3 text-sm text-muted">
              Ask a chatbot where an indie band should tour and you get the same ten big cities for everyone. It has no idea that your particular fans over-index in
              Minneapolis and not in Miami, which rooms they go to, or which brand they&apos;d trust.
            </p>
          </div>
          <div className="lg:col-span-2 grid gap-3 sm:grid-cols-2">
            {[
              ["Grounded, not guessed", "Every city score, venue, support act and brand comes from a Qloo API call you can inspect in the Receipts tab."],
              ["Guard-railed agent", "The final plan is validated server-side: the agent can only pick venues, acts and brands that Qloo actually returned."],
              ["Cross-domain taste", "Qloo links music to food, fashion, TV and podcasts, so Roadie can suggest the taproom for the meet-up and the podcast for the pre-tour interview."],
              ["Privacy-safe", "Only public act names go to Qloo. Results describe aggregate audience affinity, never individuals."],
            ].map(([t, d]) => (
              <div key={t} className="ticket rounded-xl p-4">
                <div className="font-semibold text-amber">{t}</div>
                <p className="mt-1 text-sm text-text/80">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-muted">
        Built for the Qloo Agentic Hackathon. Taste data © Qloo. Basemap © Esri, © OpenStreetMap contributors. Open source under the MIT license.
      </footer>
    </div>
  );
}
