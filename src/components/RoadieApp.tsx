"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { ArrowLeft, Bot, ChevronUp, LoaderCircle, MapPin, Printer, Sparkles, X } from "lucide-react";
import { REGIONS } from "@/lib/markets";
import { useRoadie, type FeedItem } from "@/lib/useRoadie";
import { cn } from "@/lib/utils";
import { PRESETS, nextMonthStart } from "./BriefForm";
import { Landing } from "./Landing";
import { Logo, LogoMark } from "./Logo";
import { AgentFeed } from "./AgentFeed";
import { Audience, Itinerary, MarketScan, Partners, Receipts } from "./panels";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

const TourMap = dynamic(() => import("./TourMap"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-white/3" />,
});

const TABS = ["Tour", "Audience", "Partners", "Market scan", "Receipts"] as const;
type Tab = (typeof TABS)[number];

const EASE = [0.22, 1, 0.36, 1] as const;

/** One line for the mobile agent dock: what Roadie is doing right now. */
function activityLine(feed: FeedItem[], running: boolean, live?: string) {
  if (!running) return "Ask Roadie to change or write something";
  if (live) return "Writing a reply…";
  for (let i = feed.length - 1; i >= 0; i--) {
    const it = feed[i];
    if (it.kind === "tool") return it.status === "running" ? it.label : "Thinking…";
  }
  return "Reading the brief…";
}

export default function RoadieApp() {
  const r = useRoadie();
  const [tab, setTab] = useState<Tab>("Tour");
  const [focus, setFocus] = useState<string | undefined>();
  const [env, setEnv] = useState<{ qloo: string; llm: string | null } | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);

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

  // The bottom sheet is phone-only; close it if the window grows into the desktop layout.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const close = () => mq.matches && setAgentOpen(false);
    mq.addEventListener("change", close);
    return () => mq.removeEventListener("change", close);
  }, []);

  const focusCity = (city?: string) => {
    setFocus(city);
    if (city) setTab((t) => (t === "Market scan" ? t : "Tour"));
  };

  const mock = r.status.mock ?? (env ? env.qloo === "mock" : undefined);
  const calls = r.calls.length;
  const steps = r.feed.filter((f) => f.kind === "tool").length;

  let body: React.ReactNode;
  if (!r.brief) {
    body = <Landing env={env} onStart={r.start} />;
  } else {
    const brief = r.brief;
    const region = REGIONS.find((x) => x.id === brief.region)?.label;
    const image = r.board.act?.found?.image;
    const feed = (
      <AgentFeed feed={r.feed} running={r.running} live={r.live} onAsk={r.ask} canChat={!r.running || r.feed.length > 0} />
    );

    body = (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="flex min-h-dvh flex-col overflow-x-clip">
        <header className="no-print sticky top-0 z-40 border-b border-white/6 bg-background/70 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={r.reset} aria-label="New tour">
                  <ArrowLeft />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New tour</TooltipContent>
            </Tooltip>
            <Logo compact />
            <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
            <div className="flex min-w-0 items-center gap-2.5">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote Qloo image, already sized
                <img src={image} alt="" className="size-7 shrink-0 rounded-full object-cover ring-1 ring-white/15" />
              ) : (
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/8 text-xs font-semibold ring-1 ring-white/10">
                  {brief.actName.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-medium">{brief.actName}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {region} · {brief.shows} shows
                </div>
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
              {mock !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant={mock ? "danger" : "success"} className="cursor-default">
                      <span className="relative flex size-1.5">
                        {r.running && <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-70" />}
                        <span className="relative inline-flex size-1.5 rounded-full bg-current" />
                      </span>
                      <span className="max-sm:hidden">{mock ? "Demo data" : "Live Qloo"} ·</span>
                      <span className="tabular-nums">{calls}</span>
                      <span className="max-sm:hidden">calls</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {mock
                      ? "No Qloo key configured, so Roadie is using fictional demo data."
                      : "Every recommendation comes from a live Qloo API call. Inspect them in Receipts."}
                  </TooltipContent>
                </Tooltip>
              )}
              {r.status.mode && (
                <Badge className="max-md:hidden">
                  <Bot /> {r.status.mode === "agent" ? `Agent · ${r.status.model}` : "Autopilot"}
                </Badge>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" size="sm" onClick={() => window.print()} disabled={!r.board.stops.length} aria-label="Print tour sheet">
                    <Printer className="size-3.5" />
                    <span className="max-sm:hidden">Tour sheet</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Print or save the tour as a PDF</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        <div className="no-print mx-auto grid w-full max-w-[1680px] flex-1 grid-cols-1 gap-3 p-3 pb-28 sm:gap-4 sm:p-4 sm:pb-28 lg:h-[calc(100dvh-3.5rem)] lg:flex-none lg:grid-cols-[minmax(340px,380px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:pb-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="glass hidden min-h-0 flex-col overflow-hidden rounded-2xl lg:flex">
            <div className="flex items-center gap-3 border-b border-white/6 px-4 py-3">
              <LogoMark className="size-8" />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-sm font-semibold tracking-tight">Roadie agent</div>
                <div className="text-[11px] text-muted-foreground">
                  {r.running ? <span className="shimmer-text">Working on your tour…</span> : `${steps} steps · ready for follow-ups`}
                </div>
              </div>
              {r.running && <LoaderCircle className="size-4 animate-spin text-primary" />}
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-4 pt-3 pb-4">{feed}</div>
          </aside>

          <main className="flex min-h-0 min-w-0 flex-col gap-3 sm:gap-4">
            <section
              aria-label="Tour map"
              className="glass relative isolate h-[300px] shrink-0 overflow-hidden rounded-2xl sm:h-[380px] lg:h-[44%] lg:min-h-[260px]"
            >
              <TourMap board={r.board} focusCity={focus} />
              {focus && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-strong absolute top-3 right-3 z-[1000] flex h-8 items-center gap-1.5 rounded-full pr-1 pl-3 text-xs font-medium"
                >
                  <MapPin className="size-3.5 text-primary" />
                  {focus}
                  <button
                    onClick={() => setFocus(undefined)}
                    aria-label="Show the full route"
                    className="grid size-6 cursor-pointer place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </motion.div>
              )}
              <div className="glass-strong pointer-events-none absolute bottom-3 left-3 z-[1000] hidden items-center gap-3.5 rounded-xl px-3 py-1.5 text-[11px] text-muted-foreground sm:flex">
                {focus ? (
                  <>
                    <Legend color="bg-primary/70" label="Fan hotspots" />
                    <Legend color="bg-teal-400" label="Venues" />
                    <Legend color="bg-foreground" label="Local spots" />
                  </>
                ) : (
                  <>
                    <Legend color="bg-primary" label="Tour route" />
                    <Legend color="bg-indigo-400/80" label="Fan affinity by city" />
                  </>
                )}
              </div>
            </section>

            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="glass min-h-0 flex-1 rounded-2xl lg:overflow-hidden">
              <div className="sticky top-14 z-30 rounded-t-2xl border-b border-white/6 bg-[#0c0e15]/95 px-2 py-2 backdrop-blur-xl sm:px-3 lg:static lg:bg-transparent lg:backdrop-blur-none">
                <TabsList className="no-scrollbar flex w-full justify-start overflow-x-auto sm:inline-flex sm:w-auto">
                  {TABS.map((t) => (
                    <TabsTrigger key={t} value={t}>
                      {tab === t && (
                        <motion.span
                          layoutId="tab-pill"
                          className="absolute inset-0 rounded-lg border border-white/10 bg-white/10"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
                        />
                      )}
                      <span className="relative">{t}</span>
                      {t === "Receipts" && calls > 0 && (
                        <span className="relative rounded-md bg-primary/15 px-1.5 text-[11px] font-semibold text-primary tabular-nums">{calls}</span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="scroll-thin min-h-0 flex-1 p-4 sm:p-5 lg:overflow-y-auto">
                {TABS.map((t) => (
                  <TabsContent key={t} value={t}>
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>
                      {t === "Tour" && <Itinerary board={r.board} focus={focus} onFocus={focusCity} onAsk={r.running ? undefined : r.ask} />}
                      {t === "Audience" && <Audience board={r.board} />}
                      {t === "Partners" && <Partners board={r.board} />}
                      {t === "Market scan" && <MarketScan board={r.board} onFocus={focusCity} />}
                      {t === "Receipts" && <Receipts calls={r.calls} />}
                    </motion.div>
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          </main>
        </div>

        <Sheet open={agentOpen} onOpenChange={setAgentOpen}>
          <div className="no-print fixed inset-x-3 bottom-3 z-40 mb-[env(safe-area-inset-bottom)] lg:hidden">
            <SheetTrigger asChild>
              <motion.button
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
                className="glass-strong mx-auto flex w-full max-w-xl cursor-pointer items-center gap-3 rounded-2xl p-2 pr-4 text-left"
                aria-label="Open Roadie agent"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/12 text-primary">
                  {r.running ? <LoaderCircle className="size-[18px] animate-spin" /> : <Sparkles className="size-[18px]" />}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[11px] font-medium text-muted-foreground">{r.running ? "Roadie is working" : `Roadie agent · ${steps} steps`}</span>
                  <span className={cn("block truncate text-sm font-medium", r.running && "shimmer-text")}>{activityLine(r.feed, r.running, r.live)}</span>
                </span>
                <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
              </motion.button>
            </SheetTrigger>
          </div>
          <SheetContent className="h-[85dvh] lg:hidden">
            <SheetHeader>
              <SheetTitle>Roadie agent</SheetTitle>
              <SheetDescription>{r.running ? "Working on your tour…" : "Ask for changes, emails, posts or pitches."}</SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">{feed}</div>
          </SheetContent>
        </Sheet>

        <div className="print-only space-y-6 p-6">
          <h1 className="font-serif text-4xl">{brief.actName}: tour sheet</h1>
          <Itinerary board={r.board} onFocus={() => {}} />
          <Partners board={r.board} />
          <Audience board={r.board} />
          <p className="text-xs">Planned with Roadie using Qloo taste data. Affinity reflects aggregate audience taste, not ticket demand.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>{body}</TooltipProvider>
    </MotionConfig>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", color)} />
      {label}
    </span>
  );
}
