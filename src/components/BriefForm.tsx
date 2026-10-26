"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Mic, Music2, Radio, X } from "lucide-react";
import { MARKETS, REGIONS, type RegionId } from "@/lib/markets";
import type { ActType, Brief } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input, Textarea, fieldClass } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Slider } from "./ui/slider";

const TYPES: { id: ActType; label: string; icon: typeof Music2 }[] = [
  { id: "musician", label: "Musician", icon: Music2 },
  { id: "comedian", label: "Comedian", icon: Mic },
  { id: "podcast", label: "Live podcast", icon: Radio },
];

/** Radix Select reserves "" for "no value", so the optional home city uses a sentinel. */
const NO_CITY = "none";

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

  return (
    <Card className="p-5 sm:p-7">
      <div className="mb-5">
        <h2 className="font-serif text-3xl leading-none tracking-tight">Plan a tour</h2>
        <p className="mt-2 text-sm text-muted-foreground">Describe the act. Roadie does the market research.</p>
      </div>

      <div className="mb-6">
        <p className="text-xs font-medium text-muted-foreground">Start from an example</p>
        <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
          {PRESETS.map((p) => (
            <Button key={p.label} type="button" variant="secondary" size="sm" className="rounded-full" onClick={() => applyPreset(p)}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/6 bg-black/25 p-1" role="radiogroup" aria-label="Act type">
          {TYPES.map((t) => {
            const on = actType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setActType(t.id)}
                className={cn(
                  "relative flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg text-[13px] font-medium transition-colors sm:text-sm",
                  on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {on && (
                  <motion.span
                    layoutId="act-type"
                    className="absolute inset-0 rounded-lg border border-white/10 bg-white/10 shadow-sm"
                    transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
                  />
                )}
                <t.icon className={cn("relative size-4 max-sm:hidden", on && "text-primary")} />
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative space-y-2">
          <Label htmlFor="act-name">Your act</Label>
          <Input
            id="act-name"
            value={actName}
            onChange={(e) => setActName(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            placeholder="Band, comic or show name"
            autoComplete="off"
            required
            maxLength={80}
          />
          {focus && suggest.length > 0 && actName.length >= 2 && (
            <ul className="glass-strong absolute z-20 mt-1 w-full animate-pop-in overflow-hidden rounded-xl p-1">
              {suggest.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={() => {
                      setActName(s.name);
                      setSuggest([]);
                    }}
                    className="w-full cursor-pointer truncate rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/8"
                  >
                    {s.name} {s.about && <span className="text-xs text-muted-foreground">· {s.about}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="sounds-like">
            Sounds like / shares fans with <span className="font-normal text-muted-foreground/70">· key for new acts</span>
          </Label>
          <div className={cn(fieldClass, "flex min-h-10 flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10")}>
            {soundsLike.map((s) => (
              <span key={s} className="flex items-center gap-1 rounded-md border border-white/8 bg-white/8 py-0.5 pr-1 pl-2 text-xs">
                {s}
                <button
                  type="button"
                  aria-label={`Remove ${s}`}
                  className="grid size-4 cursor-pointer place-items-center rounded text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  onClick={() => setSoundsLike(soundsLike.filter((x) => x !== s))}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              id="sounds-like"
              className="h-6 min-w-32 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground/70"
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Region</Label>
            <Select
              value={region}
              onValueChange={(v) => {
                setRegion(v as RegionId);
                setHomeCity("");
              }}
            >
              <SelectTrigger aria-label="Region">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>
              Home city <span className="font-normal text-muted-foreground/70">· optional</span>
            </Label>
            <Select value={homeCity || NO_CITY} onValueChange={(v) => setHomeCity(v === NO_CITY ? "" : v)}>
              <SelectTrigger aria-label="Home city">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CITY}>None</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c.city} value={c.city}>
                    {c.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="justify-between">
              Shows <span className="font-mono text-foreground tabular-nums">{shows}</span>
            </Label>
            <div className="flex h-10 items-center">
              <Slider min={3} max={10} step={1} value={[shows]} onValueChange={([v]) => setShows(v)} aria-label="Number of shows" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="start-date">First show</Label>
            <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Anything Roadie should know?</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="Room sizes, budget, must-play cities…"
          />
        </div>

        <Button type="submit" size="lg" className="group w-full" disabled={disabled || !actName.trim()}>
          Plan my tour
          <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
        </Button>
      </form>
    </Card>
  );
}
