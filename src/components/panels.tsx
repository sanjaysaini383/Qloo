"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  Car,
  ChevronDown,
  Coffee,
  Fingerprint,
  Handshake,
  MapPin,
  Plane,
  Podcast,
  Radar,
  ReceiptText,
  Route,
  Sparkles,
  Store,
  Ticket,
  Tv,
  Users,
  type LucideIcon,
} from "lucide-react";
/* eslint-disable @next/next/no-img-element -- Qloo images are remote and already sized */
import type { Board, Entity, QlooCallView, Stop } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const EASE = [0.22, 1, 0.36, 1] as const;

const pct = (n?: number) => (n === undefined ? "–" : `${Math.round(n * 100)}`);

const day = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en", { ...opts, timeZone: "UTC" });

/** "Dec 1–8", or "Dec 28 – Jan 4" across a month boundary. */
const dateRange = (from: string, to: string) => {
  const a = day(from, { month: "short", day: "numeric" });
  if (from.slice(0, 7) === to.slice(0, 7)) return `${a}–${day(to, { day: "numeric" })}`;
  return `${a} – ${day(to, { month: "short", day: "numeric" })}`;
};

function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-2xl border border-white/8 bg-white/4 text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h4 className={cn("text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase", className)}>{children}</h4>;
}

function Panel({ title, hint, icon: Icon, children, className }: { title: string; hint?: string; icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("surface rounded-2xl p-4 sm:p-5", className)}>
      <div className="mb-3.5 flex items-start gap-2.5">
        {Icon && (
          <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/5 text-primary">
            <Icon className="size-3.5" />
          </span>
        )}
        <div className="min-w-0">
          <h4 className="text-sm font-semibold tracking-tight">{title}</h4>
          {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Meter({ value, max = 1, className = "bg-primary" }: { value: number; max?: number; className?: string }) {
  const width = Math.max(2, Math.min(100, (value / max) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
      <motion.div
        className={cn("h-full rounded-full", className)}
        initial={{ width: 0 }}
        animate={{ width: `${width}%` }}
        transition={{ duration: 0.8, ease: EASE }}
      />
    </div>
  );
}

function Avatar({ e }: { e: Entity }) {
  return e.image ? (
    <img src={e.image} alt="" loading="lazy" className="size-8 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />
  ) : (
    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/6 text-xs font-semibold text-muted-foreground ring-1 ring-white/8">
      {e.name.charAt(0).toUpperCase()}
    </span>
  );
}

const TONES = {
  venue: "border-teal-400/20 bg-teal-400/10 text-teal-300",
  opener: "border-rose-400/20 bg-rose-400/10 text-rose-300",
  spot: "border-primary/20 bg-primary/10 text-primary",
};

function Pick({ icon: Icon, tone, kind, e, sub }: { icon: LucideIcon; tone: keyof typeof TONES; kind: string; e: Entity; sub?: string }) {
  return (
    <div className="flex min-w-0 gap-2.5">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg border", TONES[tone])}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{kind}</div>
        <div className="truncate text-sm font-medium">{e.name}</div>
        {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ itinerary */

export function Itinerary({
  board,
  focus,
  onFocus,
  onAsk,
}: {
  board: Board;
  focus?: string;
  onFocus: (city?: string) => void;
  onAsk?: (q: string) => void;
}) {
  if (!board.stops.length) {
    const scanned = board.markets.length;
    return <Empty icon={Route} text={scanned ? `Scanned ${scanned} markets. Routing the tour next…` : "Your routed tour will appear here."} />;
  }
  const maxAff = Math.max(...board.markets.map((m) => m.affinity), 0.0001);
  const totalKm = board.stops.reduce((s, x) => s + x.travel.km, 0);
  const first = board.stops[0].date;
  const last = board.stops[board.stops.length - 1].date;
  return (
    <div className="space-y-3">
      <div className="relative break-inside-avoid overflow-hidden rounded-2xl border border-primary/15 bg-linear-to-br from-primary/10 via-white/2 to-transparent p-5 sm:p-6">
        <p className="text-[11px] font-medium tracking-[0.14em] text-primary uppercase">Tour plan</p>
        {board.headline && <h3 className="mt-2 font-serif text-3xl leading-[1.05] tracking-tight text-balance sm:text-4xl">{board.headline}</h3>}
        {board.summary && <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground/75">{board.summary}</p>}
        <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/8 bg-white/8">
          {[
            ["Shows", String(board.stops.length)],
            ["Dates", dateRange(first, last)],
            ["Distance", `${totalKm.toLocaleString()} km`],
          ].map(([k, v]) => (
            <div key={k} className="bg-background/80 px-3 py-2.5 sm:px-4">
              <dt className="text-[11px] text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums sm:text-base">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      {board.stops.map((s, i) => (
        <motion.div key={s.city} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.05, ease: EASE }}>
          <StopCard
            s={s}
            maxAff={maxAff}
            active={focus === s.city}
            onClick={() => onFocus(focus === s.city ? undefined : s.city)}
            board={board}
            onAsk={onAsk}
          />
        </motion.div>
      ))}
    </div>
  );
}

function StopCard({
  s,
  maxAff,
  active,
  onClick,
  board,
  onAsk,
}: {
  s: Stop;
  maxAff: number;
  active: boolean;
  onClick: () => void;
  board: Board;
  onAsk?: (q: string) => void;
}) {
  const scout = board.scouts[s.city];
  const actions: [string, string][] = [
    ...(s.venue ? [["Draft booking pitch", `Draft a booking pitch email to ${s.venue.name} for the ${s.city} show on ${s.date}`] as [string, string]] : []),
    ["Find another venue", `Find a different venue in ${s.city} and update the plan`],
    ["Write Instagram post", `Write a ${s.city}-specific Instagram post for this show`],
  ];
  return (
    <article
      className={cn(
        "surface break-inside-avoid overflow-hidden rounded-2xl transition-colors",
        active ? "border-primary/35 bg-primary/4 ring-1 ring-primary/25" : "hover:border-white/12 hover:bg-white/4",
      )}
    >
      <button onClick={onClick} aria-expanded={active} className="flex w-full cursor-pointer items-stretch text-left">
        <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 border-r border-white/6 py-4 sm:w-20">
          <span className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">{day(s.date, { month: "short" })}</span>
          <span className="font-serif text-4xl leading-none">{new Date(`${s.date}T12:00:00Z`).getUTCDate()}</span>
          <span className="text-[11px] text-muted-foreground">{day(s.date, { weekday: "short" })}</span>
        </div>
        <div className="min-w-0 flex-1 p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{s.order}</span>
              <h4 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                {s.city}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">{s.country}</span>
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <Badge>
                {s.travel.mode === "start" ? (
                  "Opening night"
                ) : (
                  <>
                    {s.travel.mode === "fly" ? <Plane /> : <Car />} {s.travel.km.toLocaleString()} km · {s.travel.hours} h
                  </>
                )}
              </Badge>
              <ChevronDown className={cn("no-print size-4 text-muted-foreground transition-transform duration-300", active && "rotate-180")} />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="shrink-0 text-xs text-muted-foreground">Fan index</span>
            <Meter value={s.affinity} max={maxAff} />
            <span className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums">{pct(s.affinity)}</span>
          </div>

          {scout && scout.hotspots.length > 0 && (
            <p className="mt-2.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0 text-primary" />
              <span className="truncate">
                Fans cluster in{" "}
                <span className="text-foreground/85">
                  {scout.hotspots
                    .slice(0, 4)
                    .map((h) => h.name)
                    .join(" · ")}
                </span>
              </span>
            </p>
          )}
          {s.angle && <p className="mt-3 text-sm leading-relaxed text-foreground/80">{s.angle}</p>}

          {(s.venue || s.opener || s.hangout) && (
            <div className="mt-4 grid gap-3 border-t border-white/6 pt-4 sm:grid-cols-3">
              {s.venue && <Pick icon={Ticket} tone="venue" kind="Venue" e={s.venue} sub={s.venue.address ?? s.venue.disambiguation} />}
              {s.opener && <Pick icon={Users} tone="opener" kind="Support act" e={s.opener} sub={s.opener.disambiguation ?? s.opener.tags.slice(0, 2).map((t) => t.name).join(" · ")} />}
              {s.hangout && <Pick icon={Coffee} tone="spot" kind="Local spot" e={s.hangout} sub={s.hangout.address ?? s.hangout.tags[0]?.name} />}
            </div>
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {active && scout && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="grid gap-5 border-t border-white/6 bg-black/15 p-4 sm:grid-cols-2 sm:p-5">
              <div>
                <SectionLabel>Other taste-matched venues</SectionLabel>
                <ul className="mt-2.5 space-y-2">
                  {scout.venues
                    .filter((v) => v.id !== s.venue?.id)
                    .slice(0, 4)
                    .map((v) => (
                      <li key={v.id} className="min-w-0 text-sm">
                        <div className="truncate">{v.name}</div>
                        {v.address && <div className="truncate text-xs text-muted-foreground">{v.address}</div>}
                      </li>
                    ))}
                  {scout.venues.length <= 1 && <li className="text-xs text-muted-foreground">No alternates returned.</li>}
                </ul>
              </div>
              <div>
                <SectionLabel>Where fans hang out</SectionLabel>
                <ul className="mt-2.5 space-y-2">
                  {scout.hangouts.slice(0, 5).map((v) => (
                    <li key={v.id} className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
                      <span className="truncate">{v.name}</span>
                      {v.tags[0] && <span className="shrink-0 text-xs text-muted-foreground capitalize">{v.tags[0].name}</span>}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground sm:col-span-2">
                <MapPin className="mt-px size-3.5 shrink-0" />
                The map shows the {scout.hotspots.length} neighbourhoods where fans over-index (amber), venues (teal) and local spots (white) in {s.city}.
              </p>
              {onAsk && (
                <div className="no-print flex flex-wrap gap-2 sm:col-span-2">
                  {actions.map(([label, q]) => (
                    <Button key={label} variant="secondary" size="sm" className="rounded-full" onClick={() => onAsk(q)}>
                      <Sparkles className="size-3.5 text-primary" />
                      {label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

/* ------------------------------------------------------------- audience */

const AGE_LABEL: Record<string, string> = {
  "24_and_younger": "≤24",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55+",
  "35_and_younger": "≤35",
  "36_to_55": "36–55",
};

function Diverging({ rec, labels = {} }: { rec: Record<string, number>; labels?: Record<string, string> }) {
  const max = Math.max(0.01, ...Object.values(rec).map(Math.abs));
  return (
    <div className="space-y-2.5">
      {Object.entries(rec).map(([k, v]) => (
        <div key={k} className="flex items-center gap-3 text-xs">
          <span className="w-12 shrink-0 text-muted-foreground capitalize">{labels[k] ?? k}</span>
          <div className="relative h-2 flex-1 rounded-full bg-white/6">
            <span aria-hidden className="absolute -inset-y-1 left-1/2 w-px bg-white/25" />
            <motion.div
              className={cn("absolute top-0 h-full rounded-full", v >= 0 ? "left-1/2 bg-teal-400" : "right-1/2 bg-rose-400")}
              initial={{ width: 0 }}
              animate={{ width: `${(Math.abs(v) / max) * 50}%` }}
              transition={{ duration: 0.8, ease: EASE }}
            />
          </div>
          <span className={cn("w-11 text-right font-medium tabular-nums", v >= 0 ? "text-teal-300" : "text-rose-300")}>
            {v > 0 ? "+" : ""}
            {v.toFixed(2)}
          </span>
        </div>
      ))}
      <div className="flex justify-between pl-15 pr-14 text-[10px] text-muted-foreground/70">
        <span>Less likely</span>
        <span>More likely</span>
      </div>
    </div>
  );
}

export function Audience({ board }: { board: Board }) {
  const a = board.audience;
  const act = board.act;
  if (!a && !act) return <Empty icon={Fingerprint} text="Fanbase profile will appear here." />;
  return (
    <div className="space-y-4">
      {act && (
        <Panel
          title="Taste signal"
          icon={Fingerprint}
          hint={act.found ? "The act and the reference acts Roadie used to model the fanbase." : "Your act isn't in Qloo's graph yet, so Roadie models your fans through the acts they also love."}
        >
          <div className="flex flex-wrap gap-2">
            {[...(act.found ? [act.found] : []), ...act.references].map((r) => (
              <span
                key={r.id}
                className={cn(
                  "flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs font-medium",
                  r.id === act.found?.id ? "border-primary/40 bg-primary/15 text-primary" : "border-white/10 bg-white/5",
                )}
              >
                {r.image ? (
                  <img src={r.image} alt="" className="size-6 rounded-full object-cover" loading="lazy" />
                ) : (
                  <span className="grid size-6 place-items-center rounded-full bg-white/8 text-[10px]">{r.name.charAt(0)}</span>
                )}
                {r.name}
              </span>
            ))}
          </div>
        </Panel>
      )}
      {a && Object.keys(a.age).length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Age affinity" hint="Versus the average audience.">
            <Diverging rec={a.age} labels={AGE_LABEL} />
          </Panel>
          <Panel title="Gender affinity" hint="Versus the average audience.">
            <Diverging rec={a.gender} />
          </Panel>
        </div>
      )}
      {a && a.tasteTags.length > 0 && (
        <Panel title="Fan taste DNA" hint="What the fanbase over-indexes on across domains.">
          <div className="space-y-3">
            {[...new Set(a.tasteTags.map((t) => t.group ?? "Taste"))].map((g) => (
              <div key={g} className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
                <span className="w-32 shrink-0 text-xs font-medium text-primary">{g}</span>
                <div className="flex flex-wrap gap-1.5">
                  {a.tasteTags
                    .filter((t) => (t.group ?? "Taste") === g)
                    .map((t) => (
                      <span key={t.id} className="rounded-lg border border-white/8 bg-white/5 px-2.5 py-1 text-xs capitalize" title={t.type}>
                        {t.name}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {board.wildcards.length > 0 && (
        <Panel title="Destinations fans over-index on" hint="Wildcard markets worth a look beyond the scanned cities.">
          <div className="flex flex-wrap gap-1.5">
            {board.wildcards.map((w) => (
              <span key={w.id} className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/5 px-2.5 py-1 text-xs">
                <MapPin className="size-3 text-primary" />
                {w.name}
              </span>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- partners */

function RankedList({ title, items, hint, icon }: { title: string; items: Entity[]; hint: string; icon: LucideIcon }) {
  if (!items.length) return null;
  return (
    <Panel title={title} hint={hint} icon={icon}>
      <ol className="-mx-2 space-y-0.5">
        {items.slice(0, 8).map((e, i) => {
          const overlap = (e as { overlap?: string[] }).overlap;
          const sub = overlap?.length ? `Shared taste: ${overlap.join(", ")}` : (e.address ?? e.disambiguation ?? e.tags.slice(0, 2).map((t) => t.name).join(" · "));
          return (
            <li key={e.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/4">
              <span className="w-4 shrink-0 text-right text-xs font-medium text-muted-foreground tabular-nums">{i + 1}</span>
              <Avatar e={e} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{e.name}</div>
                {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
              </div>
              {e.affinity !== undefined && (
                <span className="shrink-0 rounded-md bg-white/6 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums" title="Affinity">
                  {pct(e.affinity)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

export function Partners({ board }: { board: Board }) {
  if (!board.openers.length && !board.brands.length) return <Empty icon={Handshake} text="Support acts, brand partners and media targets will appear here." />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <RankedList title="Support acts" icon={Users} items={board.openers} hint="Overlapping fans, popularity capped so they're bookable." />
      <RankedList title="Brand partners" icon={Store} items={board.brands} hint="Brands the fanbase over-indexes on: sponsorship, merch, bar partners." />
      <RankedList title="Podcasts to pitch" icon={Podcast} items={board.podcasts} hint="Pre-tour interviews where the fans already listen." />
      <RankedList title="TV shows fans watch" icon={Tv} items={board.shows} hint="Content hooks, references and ad-buy targeting." />
    </div>
  );
}

/* ---------------------------------------------------------- market scan */

const SCAN_COLS = "grid-cols-[1.25rem_minmax(0,7rem)_minmax(0,1fr)_1.75rem] sm:grid-cols-[1.5rem_minmax(0,10rem)_minmax(0,1fr)_2.5rem_4.5rem]";

export function MarketScan({ board, onFocus }: { board: Board; onFocus: (city: string) => void }) {
  if (!board.markets.length) return <Empty icon={Radar} text="Every candidate city, ranked by Qloo fan affinity." />;
  const max = Math.max(...board.markets.map((m) => m.affinity), 0.0001);
  const chosen = new Set(board.stops.map((s) => s.city));
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
        Fan index 0–100: Qloo&apos;s {board.markets[0].evidence.replace(/ \(.*\)$/, "")}, rescaled across the cities scanned. 0 means Qloo found no local
        resonance. Cities marked <span className="inline-block size-1.5 -translate-y-px rounded-full bg-primary align-middle" /> made the tour.
      </p>
      <div className="surface overflow-hidden rounded-2xl">
        <div className={cn("grid items-center gap-3 border-b border-white/6 px-4 py-2.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase", SCAN_COLS)}>
          <span>#</span>
          <span>City</span>
          <span>Fan index</span>
          <span className="text-right">Score</span>
          <span className="hidden text-right sm:block">Raw</span>
        </div>
        <ul className="divide-y divide-white/5">
          {board.markets.map((m, i) => {
            const on = chosen.has(m.city);
            return (
              <li key={m.city}>
                <button
                  onClick={() => onFocus(m.city)}
                  className={cn("grid w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/4", SCAN_COLS)}
                >
                  <span className="text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("truncate", on && "font-semibold")}>{m.city}</span>
                    {on && <span className="size-1.5 shrink-0 rounded-full bg-primary" title="On the tour" />}
                  </span>
                  <Meter value={m.affinity} max={max} className={on ? "bg-primary" : "bg-indigo-400/60"} />
                  <span className="text-right text-xs font-semibold tabular-nums">{pct(m.affinity)}</span>
                  <span className="hidden text-right font-mono text-[11px] text-muted-foreground sm:block" title="Mean raw Qloo affinity">
                    {m.raw ? m.raw.toFixed(4) : "–"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- receipts */

function CallParams({ c }: { c: QlooCallView }) {
  return (
    <div className="min-w-0 font-mono text-[11px] text-muted-foreground">
      <span className="text-teal-300">GET {c.path}</span>
      {Object.entries(c.params).map(([k, v]) => (
        <div key={k} className="truncate" title={`${k}=${v}`}>
          {k}=<span className="text-foreground/80">{v}</span>
        </div>
      ))}
    </div>
  );
}

export function Receipts({ calls }: { calls: QlooCallView[] }) {
  if (!calls.length) return <Empty icon={ReceiptText} text="Every Qloo API call Roadie makes is logged here." />;
  const live = calls.filter((c) => !c.cached).length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Qloo calls", calls.length],
          ["Live", live],
          ["From cache", calls.length - live],
        ].map(([k, v]) => (
          <div key={k} className="surface rounded-xl px-3 py-2.5 sm:px-4">
            <div className="text-[11px] text-muted-foreground">{k}</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">This is the evidence behind every recommendation. The API key never leaves the server.</p>

      <ul className="space-y-2 sm:hidden">
        {calls.map((c) => (
          <li key={c.id} className="surface space-y-2 rounded-xl p-3">
            <div className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="mr-1.5 text-xs text-muted-foreground tabular-nums">#{c.id}</span>
                {c.purpose}
                {c.status !== 200 && <span className="ml-1 text-rose-300">({c.status})</span>}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {c.count} · {c.cached ? "cache" : `${c.ms} ms`}
              </span>
            </div>
            <CallParams c={c} />
          </li>
        ))}
      </ul>

      <div className="surface scroll-thin hidden max-h-[60vh] overflow-auto rounded-2xl sm:block">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#0f111a]/95 text-[10px] tracking-wider text-muted-foreground uppercase backdrop-blur">
            <tr>
              <th className="px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Purpose</th>
              <th className="px-3 py-2.5 font-medium">Request</th>
              <th className="px-3 py-2.5 text-right font-medium">Results</th>
              <th className="px-3 py-2.5 text-right font-medium">ms</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {calls.map((c) => (
              <tr key={c.id} className="align-top transition-colors hover:bg-white/3">
                <td className="px-3 py-2 text-muted-foreground tabular-nums">{c.id}</td>
                <td className="px-3 py-2">
                  {c.purpose}
                  {c.status !== 200 && <span className="ml-1 text-rose-300">({c.status})</span>}
                </td>
                <td className="max-w-[24rem] px-3 py-2">
                  <CallParams c={c} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{c.count}</td>
                <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{c.cached ? "cache" : c.ms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
