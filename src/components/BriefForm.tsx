"use client";
import { useEffect, useMemo, useState } from "react";
import { Mic, Music2, Radio, Sparkles, X } from "lucide-react";
import { MARKETS, REGIONS, type RegionId } from "@/lib/markets";
import type { ActType, Brief } from "@/lib/types";

const TYPES: { id: ActType; label: string; icon: typeof Music2 }[] = [
  { id: "musician", label: "Musician", icon: Music2 },
  { id: "comedian", label: "Comedian", icon: Mic },
  { id: "podcast", label: "Live podcast", icon: Radio },
];

/** First day of the month after next, in UTC so the server render and the browser agree. */
export function nextMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1)).toISOString().slice(0, 10);
}

export const PRESETS: { label: string; brief: Omit<Brief, "startDate"> }[] = [
  {
    label: "Unsigned dream-pop band",
    brief: {
      actName: "The Velvet Teeth",
      actType: "musician",
      soundsLike: ["Beach House", "Alvvays", "Mitski"],
      region: "north_america",
      shows: 6,
      homeCity: "Chicago",
      notes: "Brand-new band, 2k monthly listeners, can play 150-400 cap rooms. Van tour.",
    },
  },
  {
    label: "Indie folk headliner",
    brief: {
      actName: "Big Thief",
      actType: "musician",
      soundsLike: ["Adrianne Lenker", "Phoebe Bridgers"],
      region: "uk_europe",
      shows: 7,
      notes: "Want intimate rooms and one big-city statement show.",
    },
  },
  {
    label: "Stand-up comic",
    brief: {
      actName: "Hasan Minhaj",
      actType: "comedian",
      soundsLike: ["Ali Wong", "John Mulaney"],
      region: "north_america",
      shows: 6,
    },
  },
  {
    label: "Indian indie artist",
    brief: {
      actName: "Prateek Kuhad",
      actType: "musician",
      soundsLike: ["The Local Train", "When Chai Met Toast"],
      region: "india",
      shows: 6,
      homeCity: "Delhi",
    },
  },
];

export function BriefForm({ onSubmit, disabled }: { onSubmit: (b: Brief) => void; disabled?: boolean }) {
  const [actType, setActType] = useState<ActType>("musician");
  const [actName, setActName] = useState("");
  const [soundsLike, setSoundsLike] = useState<string[]>([]);
  const [refDraft, setRefDraft] = useState("");
  const [region, setRegion] = useState<RegionId>("north_america");
  const [shows, setShows] = useState(6);
  const [startDate, setStartDate] = useState(nextMonthStart);
  const [homeCity, setHomeCity] = useState("");
  const [notes, setNotes] = useState("");
  const [suggest, setSuggest] = useState<{ id: string; name: string; about?: string }[]>([]);
  const [focus, setFocus] = useState(false);

  const cities = useMemo(() => MARKETS.filter((m) => m.region === region), [region]);

  useEffect(() => {
    if (actName.trim().length < 2 || !focus) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?type=${actType}&q=${encodeURIComponent(actName)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setSuggest(d.results ?? []))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [actName, actType, focus]);

  const addRef = (v: string) => {
    const s = v.trim();
    if (s && soundsLike.length < 5 && !soundsLike.includes(s)) setSoundsLike([...soundsLike, s]);
    setRefDraft("");
  };

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setActType(p.brief.actType);
    setActName(p.brief.actName);
    setSoundsLike(p.brief.soundsLike);
    setRegion(p.brief.region);
    setShows(p.brief.shows);
    setHomeCity(p.brief.homeCity ?? "");
    setNotes(p.brief.notes ?? "");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const refs = refDraft.trim() ? [...soundsLike, refDraft.trim()].slice(0, 5) : soundsLike;
    if (!actName.trim()) return;
    onSubmit({
      actName: actName.trim(),
      actType,
      soundsLike: refs,
      region,
      shows,
      startDate,
      homeCity: homeCity || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const field = "w-full rounded-lg border border-line bg-ink/60 px-3 py-2.5 text-sm outline-none focus:border-amber";

  return (
    <form onSubmit={submit} className="ticket rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl shadow-black/40">
      <div className="flex flex-wrap gap-2">
        <span className="text-xs uppercase tracking-widest text-muted self-center mr-1">Try</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p)}
            className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-amber hover:text-amber transition"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Act type">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={actType === t.id}
            onClick={() => setActType(t.id)}
            className={`flex items-center justify-center gap-2 rounded-lg border px-2 py-2.5 text-sm transition ${
              actType === t.id ? "border-amber bg-amber/10 text-amber" : "border-line text-muted hover:text-text"
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <label className="text-xs uppercase tracking-widest text-muted">Your act</label>
        <input
          className={`${field} mt-1`}
          value={actName}
          onChange={(e) => setActName(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          placeholder="Band, comic or show name"
          required
          maxLength={80}
        />
        {focus && suggest.length > 0 && actName.length >= 2 && (
          <ul className="absolute z-20 mt-1 w-full rounded-lg border border-line bg-panel-2 shadow-xl">
            {suggest.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onMouseDown={() => {
                    setActName(s.name);
                    setSuggest([]);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-ink/60"
                >
                  {s.name} {s.about && <span className="text-muted text-xs">· {s.about}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="text-xs uppercase tracking-widest text-muted">
          Sounds like / shares fans with <span className="normal-case tracking-normal">(key for new acts)</span>
        </label>
        <div className={`${field} mt-1 flex flex-wrap items-center gap-1.5`}>
          {soundsLike.map((s) => (
            <span key={s} className="flex items-center gap-1 rounded-md bg-panel-2 px-2 py-0.5 text-xs">
              {s}
              <button type="button" aria-label={`Remove ${s}`} onClick={() => setSoundsLike(soundsLike.filter((x) => x !== s))}>
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            className="min-w-[8rem] flex-1 bg-transparent outline-none"
            value={refDraft}
            onChange={(e) => setRefDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addRef(refDraft);
              }
            }}
            onBlur={() => refDraft && addRef(refDraft)}
            placeholder={soundsLike.length >= 5 ? "" : "Type an act, press Enter"}
            disabled={soundsLike.length >= 5}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted">Region</label>
          <select
            className={`${field} mt-1`}
            value={region}
            onChange={(e) => {
              setRegion(e.target.value as RegionId);
              setHomeCity("");
            }}
          >
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted">Home city (optional)</label>
          <select className={`${field} mt-1`} value={homeCity} onChange={(e) => setHomeCity(e.target.value)}>
            <option value="">None</option>
            {cities.map((c) => (
              <option key={c.city}>{c.city}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted">Shows: {shows}</label>
          <input
            type="range"
            min={3}
            max={10}
            value={shows}
            onChange={(e) => setShows(Number(e.target.value))}
            className="mt-3 w-full accent-[var(--color-amber)]"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted">First show</label>
          <input type="date" className={`${field} mt-1`} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-widest text-muted">Anything Roadie should know?</label>
        <textarea
          className={`${field} mt-1 h-16 resize-none`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          placeholder="Room sizes, budget, must-play cities…"
        />
      </div>

      <button
        disabled={disabled || !actName.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber py-3 font-semibold text-ink transition hover:brightness-110 disabled:opacity-50"
      >
        <Sparkles size={18} /> Plan my tour
      </button>
    </form>
  );
}
