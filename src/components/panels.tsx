"use client";
import { Car, Coffee, MapPin, Plane, Ticket, Users } from "lucide-react";
import type { Board, Entity, QlooCallView, Stop } from "@/lib/types";

const pct = (n?: number) => (n === undefined ? "–" : `${Math.round(n * 100)}`);

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-muted">{text}</p>;
}

function Meter({ value, max = 1, color = "bg-amber" }: { value: number; max?: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/60">
      <div className={`h-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, (value / max) * 100))}%` }} />
    </div>
  );
}

function EntityChip({ e, sub }: { e: Entity; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-medium">{e.name}</div>
      <div className="truncate text-xs text-muted">{sub ?? e.address ?? e.disambiguation ?? e.tags.slice(0, 2).map((t) => t.name).join(" · ")}</div>
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
    return <Empty text={scanned ? `Scanned ${scanned} markets. Routing the tour next…` : "Your routed tour will appear here."} />;
  }
  const maxAff = Math.max(...board.markets.map((m) => m.affinity), 0.0001);
  const totalKm = board.stops.reduce((s, x) => s + x.travel.km, 0);
  return (
    <div className="space-y-3">
      {(board.headline || board.summary) && (
        <div className="rounded-xl border border-amber/30 bg-amber/5 p-4">
          {board.headline && <h3 className="font-display text-2xl uppercase tracking-wide text-amber">{board.headline}</h3>}
          {board.summary && <p className="mt-1 text-sm text-text/85">{board.summary}</p>}
          <p className="mt-2 text-xs text-muted">
            {board.stops.length} shows · {board.stops[0].date} → {board.stops[board.stops.length - 1].date} · {totalKm.toLocaleString()} km
          </p>
        </div>
      )}
      {board.stops.map((s) => (
        <StopCard
          key={s.city}
          s={s}
          maxAff={maxAff}
          active={focus === s.city}
          onClick={() => onFocus(focus === s.city ? undefined : s.city)}
          board={board}
          onAsk={onAsk}
        />
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
  const date = new Date(`${s.date}T12:00:00Z`);
  return (
    <article className={`ticket overflow-hidden rounded-xl transition ${active ? "ring-1 ring-amber" : ""}`}>
      <button onClick={onClick} className="flex w-full items-stretch text-left">
        <div className="flex w-16 shrink-0 flex-col items-center justify-center border-r border-dashed border-line bg-ink/40 py-3">
          <span className="text-[10px] uppercase tracking-widest text-muted">{date.toLocaleDateString("en", { month: "short", timeZone: "UTC" })}</span>
          <span className="font-display text-2xl leading-none">{date.getUTCDate()}</span>
          <span className="text-[10px] text-muted">{date.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" })}</span>
        </div>
        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="truncate font-display text-xl uppercase tracking-wide">
              <span className="text-amber">{s.order}.</span> {s.city}
            </h4>
            <span className="shrink-0 text-xs text-muted">
              {s.travel.mode === "start" ? (
                "Opening night"
              ) : (
                <span className="inline-flex items-center gap-1">
                  {s.travel.mode === "fly" ? <Plane size={12} /> : <Car size={12} />} {s.travel.km} km · {s.travel.hours} h
                </span>
              )}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="w-28 shrink-0 text-xs text-muted">Fan affinity {pct(s.affinity)}</span>
            <Meter value={s.affinity} max={maxAff} />
          </div>
          {s.angle && <p className="mt-2 text-sm text-text/85">{s.angle}</p>}
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {s.venue && (
              <div className="flex gap-2">
                <Ticket size={14} className="mt-0.5 shrink-0 text-teal" />
                <EntityChip e={s.venue} />
              </div>
            )}
            {s.opener && (
              <div className="flex gap-2">
                <Users size={14} className="mt-0.5 shrink-0 text-pink" />
                <EntityChip e={s.opener} sub="Support act" />
              </div>
            )}
            {s.hangout && (
              <div className="flex gap-2">
                <Coffee size={14} className="mt-0.5 shrink-0 text-amber" />
                <EntityChip e={s.hangout} />
              </div>
            )}
          </div>
        </div>
      </button>
      {active && scout && (
        <div className="grid gap-3 border-t border-line bg-ink/30 p-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs uppercase tracking-widest text-muted">Other taste-matched venues</p>
            <ul className="space-y-1">
              {scout.venues.filter((v) => v.id !== s.venue?.id).slice(0, 4).map((v) => (
                <li key={v.id} className="text-sm">
                  {v.name} <span className="text-xs text-muted">{v.address}</span>
                </li>
              ))}
              {scout.venues.length <= 1 && <li className="text-xs text-muted">No alternates returned.</li>}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-widest text-muted">Where fans hang out</p>
            <ul className="space-y-1">
              {scout.hangouts.slice(0, 5).map((v) => (
                <li key={v.id} className="text-sm">
                  {v.name} <span className="text-xs text-muted">{v.tags[0]?.name}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted sm:col-span-2">
            <MapPin size={12} className="mr-1 inline" />
            Map shows {scout.hotspots.length} fan hotspots (amber), venues (teal) and local spots (white) in {s.city}.
          </p>
          {onAsk && (
            <div className="no-print flex flex-wrap gap-2 sm:col-span-2">
              {[
                s.venue && `Draft a booking pitch email to ${s.venue.name} for the ${s.city} show on ${s.date}`,
                `Find a different venue in ${s.city} and update the plan`,
                `Write a ${s.city}-specific Instagram post for this show`,
              ]
                .filter((q): q is string => !!q)
                .map((q) => (
                  <button
                    key={q}
                    onClick={() => onAsk(q)}
                    className="rounded-full border border-amber/40 px-3 py-1 text-xs text-amber hover:bg-amber/10"
                  >
                    {q.split(" ").slice(0, 4).join(" ")}…
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
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

export function Audience({ board }: { board: Board }) {
  const a = board.audience;
  const act = board.act;
  if (!a && !act) return <Empty text="Fanbase profile will appear here." />;
  const bars = (rec: Record<string, number>, labels: Record<string, string> = {}) => {
    const max = Math.max(0.01, ...Object.values(rec).map(Math.abs));
    return Object.entries(rec).map(([k, v]) => (
      <div key={k} className="flex items-center gap-2 text-xs">
        <span className="w-14 shrink-0 text-muted">{labels[k] ?? k}</span>
        <div className="relative h-3 flex-1 rounded bg-line/40">
          <div className="absolute left-1/2 top-0 h-full w-px bg-muted/50" />
          <div
            className={`absolute top-0 h-full rounded ${v >= 0 ? "bg-teal" : "bg-pink"}`}
            style={v >= 0 ? { left: "50%", width: `${(v / max) * 50}%` } : { right: "50%", width: `${(-v / max) * 50}%` }}
          />
        </div>
        <span className="w-10 text-right tabular-nums">{v > 0 ? "+" : ""}{v.toFixed(2)}</span>
      </div>
    ));
  };
  return (
    <div className="space-y-5">
      {act && (
        <section>
          <h4 className="mb-2 text-xs uppercase tracking-widest text-muted">Taste signal</h4>
          <div className="flex flex-wrap gap-2">
            {act.found && <span className="rounded-full bg-amber px-3 py-1 text-xs font-semibold text-ink">{act.found.name}</span>}
            {act.references.map((r) => (
              <span key={r.id} className="rounded-full border border-amber/50 px-3 py-1 text-xs text-amber">
                {r.name}
              </span>
            ))}
          </div>
          {!act.found && (
            <p className="mt-2 text-xs text-muted">Your act isn&apos;t in Qloo&apos;s graph yet, so Roadie models your fans through the acts they also love.</p>
          )}
        </section>
      )}
      {a && Object.keys(a.age).length > 0 && (
        <section className="grid gap-5 sm:grid-cols-2">
          <div>
            <h4 className="mb-2 text-xs uppercase tracking-widest text-muted">Age affinity vs. average</h4>
            <div className="space-y-1.5">{bars(a.age, AGE_LABEL)}</div>
          </div>
          <div>
            <h4 className="mb-2 text-xs uppercase tracking-widest text-muted">Gender affinity vs. average</h4>
            <div className="space-y-1.5">{bars(a.gender)}</div>
          </div>
        </section>
      )}
      {a && a.tasteTags.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs uppercase tracking-widest text-muted">Fan taste DNA (cross-domain)</h4>
          <div className="flex flex-wrap gap-1.5">
            {a.tasteTags.map((t) => (
              <span key={t.id} className="rounded-md bg-panel-2 px-2 py-1 text-xs" title={t.type}>
                {t.name}
              </span>
            ))}
          </div>
        </section>
      )}
      {board.wildcards.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs uppercase tracking-widest text-muted">Destinations fans over-index on</h4>
          <p className="text-sm">{board.wildcards.map((w) => w.name).join(" · ")}</p>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- partners */

function RankedList({ title, items, hint }: { title: string; items: Entity[]; hint: string }) {
  return (
    items.length ? (
      <section>
        <h4 className="text-xs uppercase tracking-widest text-muted">{title}</h4>
        <p className="mb-2 text-xs text-muted/80">{hint}</p>
        <ol className="space-y-2">
          {items.slice(0, 8).map((e, i) => (
            <li key={e.id} className="flex items-center gap-3">
              <span className="w-5 text-right font-display text-lg text-amber/80">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <EntityChip e={e} sub={(e as { overlap?: string[] }).overlap?.length ? `Shared taste: ${(e as { overlap?: string[] }).overlap!.join(", ")}` : undefined} />
              </div>
              {e.affinity !== undefined && <span className="text-xs tabular-nums text-muted">{pct(e.affinity)}</span>}
            </li>
          ))}
        </ol>
      </section>
    ) : null
  );
}

export function Partners({ board }: { board: Board }) {
  if (!board.openers.length && !board.brands.length) return <Empty text="Support acts, brand partners and media targets will appear here." />;
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <RankedList title="Support acts" items={board.openers} hint="Overlapping fans, popularity capped so they're bookable." />
      <RankedList title="Brand partners" items={board.brands} hint="Brands the fanbase over-indexes on: sponsorship, merch, bar partners." />
      <RankedList title="Podcasts to pitch" items={board.podcasts} hint="Pre-tour interviews where the fans already listen." />
      <RankedList title="TV shows fans watch" items={board.shows} hint="Content hooks, references and ad-buy targeting." />
    </div>
  );
}

/* ---------------------------------------------------------- market scan */

export function MarketScan({ board, onFocus }: { board: Board; onFocus: (city: string) => void }) {
  if (!board.markets.length) return <Empty text="Every candidate city, ranked by Qloo fan affinity." />;
  const max = Math.max(...board.markets.map((m) => m.affinity), 0.0001);
  const chosen = new Set(board.stops.map((s) => s.city));
  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        Scored by {board.markets[0].evidence.replace(/ \(\d+ results\)$/, "")} (Qloo Insights). Highlighted cities made the tour.
      </p>
      <ul className="space-y-1.5">
        {board.markets.map((m, i) => (
          <li key={m.city}>
            <button onClick={() => onFocus(m.city)} className="flex w-full items-center gap-3 text-left text-sm hover:text-amber">
              <span className="w-6 text-right text-xs tabular-nums text-muted">{i + 1}</span>
              <span className={`w-32 shrink-0 truncate ${chosen.has(m.city) ? "font-semibold text-amber" : ""}`}>{m.city}</span>
              <Meter value={m.affinity} max={max} color={chosen.has(m.city) ? "bg-amber" : "bg-pink/60"} />
              <span className="w-8 text-right text-xs tabular-nums">{pct(m.affinity)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------- receipts */

export function Receipts({ calls }: { calls: QlooCallView[] }) {
  if (!calls.length) return <Empty text="Every Qloo API call Roadie makes is logged here." />;
  const live = calls.filter((c) => !c.cached).length;
  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        {calls.length} Qloo calls ({live} live, {calls.length - live} from cache). This is the evidence behind every recommendation. API key never leaves the server.
      </p>
      <div className="scroll-thin max-h-[60vh] overflow-auto rounded-lg border border-line">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-panel-2 text-muted">
            <tr>
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">Purpose</th>
              <th className="px-2 py-1.5">Request</th>
              <th className="px-2 py-1.5 text-right">Results</th>
              <th className="px-2 py-1.5 text-right">ms</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id} className="border-t border-line/60 align-top">
                <td className="px-2 py-1.5 tabular-nums text-muted">{c.id}</td>
                <td className="px-2 py-1.5">
                  {c.purpose}
                  {c.status !== 200 && <span className="ml-1 text-pink">({c.status})</span>}
                </td>
                <td className="max-w-[22rem] px-2 py-1.5 font-mono text-[11px] text-muted">
                  <span className="text-teal">GET {c.path}</span>
                  {Object.entries(c.params).map(([k, v]) => (
                    <div key={k} className="truncate" title={`${k}=${v}`}>
                      {k}=<span className="text-text/80">{v}</span>
                    </div>
                  ))}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{c.count}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted">{c.cached ? "cache" : c.ms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
