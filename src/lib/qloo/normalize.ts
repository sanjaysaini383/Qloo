/**
 * Qloo responses are rich and vary by entity type. These helpers flatten
 * them into the small shape Roadie needs, tolerating missing fields.
 */

export interface Entity {
  id: string;
  name: string;
  subtype: string;
  popularity?: number;
  affinity?: number;
  image?: string;
  description?: string;
  disambiguation?: string;
  tags: { id: string; name: string; type: string }[];
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  priceLevel?: number;
  rating?: number;
  website?: string;
  explain?: { id: string; score: number }[];
  /** Last.fm listener count when Qloo has it (artists only); a rough size signal. */
  listeners?: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function affinityOf(raw: any): number | undefined {
  return (
    num(raw?.query?.affinity) ??
    num(raw?.query?.affinity_rank) ??
    num(raw?.affinity) ??
    num(raw?.query?.score) ??
    undefined
  );
}

export function normalizeEntity(raw: any): Entity {
  const p = raw?.properties ?? {};
  const loc = raw?.location ?? p?.location ?? p?.geocode ?? {};
  const lat = num(loc.lat) ?? num(loc.latitude) ?? num(p?.geocode?.lat);
  const lng = num(loc.lon) ?? num(loc.lng) ?? num(loc.longitude) ?? num(p?.geocode?.lon);
  const tags = Array.isArray(raw?.tags)
    ? raw.tags
        .map((t: any) => ({
          id: String(t.id ?? t.tag_id ?? ""),
          name: String(t.name ?? ""),
          type: String(t.type ?? t.subtype ?? ""),
        }))
        .filter(
          (t: { id: string; name: string }, i: number, all: { name: string }[]) =>
            t.id && t.name && all.findIndex((x) => x.name === t.name) === i,
        )
    : [];
  const explainRaw = raw?.query?.explainability?.["signal.interests.entities"];
  const explain = Array.isArray(explainRaw)
    ? explainRaw
        .map((e: any) => ({ id: String(e.entity_id ?? e.id ?? ""), score: num(e.score) ?? 0 }))
        .filter((e: { id: string }) => e.id)
    : undefined;
  return {
    id: String(raw?.entity_id ?? raw?.id ?? ""),
    name: String(raw?.name ?? "Unknown"),
    subtype: String(raw?.subtype ?? raw?.types?.[0] ?? raw?.type ?? ""),
    popularity: num(raw?.popularity),
    affinity: affinityOf(raw),
    image: p?.image?.url ?? undefined,
    description:
      typeof p?.short_description === "string"
        ? p.short_description
        : typeof p?.description === "string"
          ? p.description
          : undefined,
    disambiguation: typeof raw?.disambiguation === "string" ? raw.disambiguation : undefined,
    tags,
    address: typeof p?.address === "string" ? p.address : undefined,
    city: p?.geocode?.city ?? p?.geocode?.name ?? undefined,
    lat,
    lng,
    priceLevel: num(p?.price_level),
    rating: num(p?.business_rating),
    website: typeof p?.website === "string" ? p.website : undefined,
    explain,
    listeners: num(p?.external?.lastfm?.listeners),
  };
}

export function entitiesFrom(data: any): Entity[] {
  const list = data?.results?.entities ?? (Array.isArray(data?.results) ? data.results : []);
  return Array.isArray(list) ? list.map(normalizeEntity).filter((e) => e.id) : [];
}

export function tagsFrom(data: any): { id: string; name: string; type: string; affinity?: number }[] {
  const list = data?.results?.tags ?? data?.results ?? [];
  if (!Array.isArray(list)) return [];
  return list
    .map((t: any) => ({
      id: String(t.tag_id ?? t.id ?? ""),
      name: String(t.name ?? ""),
      type: String(t.subtype ?? t.type ?? ""),
      affinity: affinityOf(t),
    }))
    .filter((t) => t.id && t.name);
}

export interface HeatPoint {
  lat: number;
  lng: number;
  affinity: number;
  popularity: number;
  name?: string;
  /** Simplified outline as [lat, lng] pairs, for neighbourhood heatmaps. */
  polygon?: [number, number][];
}

export function heatmapFrom(data: any): HeatPoint[] {
  const list = data?.results?.heatmap;
  if (!Array.isArray(list)) return [];
  return list
    .map((h: any) => ({
      lat: num(h?.location?.latitude) ?? num(h?.location?.lat) ?? NaN,
      lng: num(h?.location?.longitude) ?? num(h?.location?.lng) ?? num(h?.location?.lon) ?? NaN,
      affinity: num(h?.query?.affinity_rank) ?? num(h?.query?.affinity) ?? 0,
      popularity: num(h?.query?.popularity) ?? 0,
      name: h?.name ?? h?.location?.name,
    }))
    .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng));
}

/** Parse the outer ring of a WKT POINT / POLYGON / MULTIPOLYGON into [lng, lat] pairs. */
export function wktRing(wkt: string): [number, number][] {
  const body = /\(+([^()]+)\)/.exec(wkt)?.[1];
  if (!body) return [];
  return body
    .split(",")
    .map((pair) => pair.trim().split(/\s+/).map(Number) as [number, number])
    .filter((p) => p.length === 2 && p.every(Number.isFinite));
}

/**
 * Neighbourhood-level heatmap (output.heatmap.boundary=urn:entity:locality).
 * Qloo also returns the containing city, county, state and townships; those are
 * dropped by footprint size so only real neighbourhoods remain.
 */
export function neighborhoodsFrom(data: any, maxSpanDeg = 0.12, maxPoints = 48): HeatPoint[] {
  const list = data?.results?.entities;
  if (!Array.isArray(list)) return [];
  const out: HeatPoint[] = [];
  for (const e of list) {
    const ring = typeof e?.boundary === "string" ? wktRing(e.boundary) : [];
    if (!ring.length || /township|county/i.test(String(e?.name))) continue;
    const lngs = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    const span = Math.max(Math.max(...lngs) - Math.min(...lngs), Math.max(...lats) - Math.min(...lats));
    if (span > maxSpanDeg) continue;
    const step = Math.max(1, Math.ceil(ring.length / maxPoints));
    out.push({
      name: String(e.name),
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
      affinity: num(e?.query?.affinity) ?? 0,
      popularity: num(e?.popularity) ?? 0,
      ...(ring.length > 2 ? { polygon: ring.filter((_, i) => i % step === 0).map(([x, y]) => [y, x] as [number, number]) } : {}),
    });
  }
  return out.sort((a, b) => b.affinity - a.affinity);
}

export type AgeBuckets = Record<string, number>;
export interface Demographics {
  age: AgeBuckets;
  gender: Record<string, number>;
}

export function demographicsFrom(data: any): Demographics[] {
  const list = data?.results?.demographics;
  if (!Array.isArray(list)) return [];
  return list.map((d: any) => ({
    age: (d?.query?.age ?? {}) as AgeBuckets,
    gender: (d?.query?.gender ?? {}) as Record<string, number>,
  }));
}
