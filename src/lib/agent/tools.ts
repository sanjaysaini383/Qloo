import "server-only";
import type { QlooSession } from "../qloo/client";
import {
  demographicsFrom,
  entitiesFrom,
  neighborhoodsFrom,
  tagsFrom,
  type Entity,
  type HeatPoint,
} from "../qloo/normalize";
import { findMarket, marketsFor, type Market } from "../markets";
import { orderStops, scheduleLegs } from "../routing";
import type { ActType, Board, MarketScore, Stop } from "../types";

export interface ToolContext {
  session: QlooSession;
  board: Board;
  actType: ActType;
}

export interface ToolResult {
  /** Short human summary for the activity feed. */
  summary: string;
  /** Compact JSON the model reasons over. */
  data: unknown;
}

export interface RoadieTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  label: (args: Record<string, unknown>) => string;
  run: (ctx: ToolContext, args: Record<string, unknown>) => Promise<ToolResult>;
}

const QLOO_TYPE: Record<ActType, string> = {
  musician: "urn:entity:artist",
  comedian: "urn:entity:person",
  podcast: "urn:entity:podcast",
};

/** Venue tag ids verified against the Qloo tag search (urn:tag:category:place / genre:place). */
const VENUE_TAGS: Record<ActType, string[]> = {
  musician: ["urn:tag:category:place:live_music_venue", "urn:tag:genre:place:live_music_venue"],
  comedian: ["urn:tag:category:place:comedy_club", "urn:tag:genre:place:comedy_club", "urn:tag:offerings:place:theater"],
  podcast: ["urn:tag:offerings:place:theater", "urn:tag:category:place:live_music_venue"],
};

const VENUE_SEARCH: Record<ActType, string> = {
  musician: "live music venue",
  comedian: "comedy club",
  podcast: "theater",
};

/** Cross-domain taste queries: what else the fanbase over-indexes on. */
const TASTE_QUERIES: { group: string; params: Record<string, string>; acts?: ActType[] }[] = [
  { group: "Sound", params: { "filter.tag.types": "urn:tag:genre:music" }, acts: ["musician"] },
  { group: "Themes & style", params: { "filter.parents.types": "urn:entity:movie,urn:entity:tv_show,urn:entity:book" } },
  { group: "On screen & page", params: { "filter.tag.types": "urn:tag:genre:media" } },
];

const round = (n?: number, d = 3) => (n === undefined ? undefined : Math.round(n * 10 ** d) / 10 ** d);

function brief(e: Entity) {
  return {
    id: e.id,
    name: e.name,
    popularity: round(e.popularity),
    affinity: round(e.affinity),
    ...(e.address ? { address: e.address } : {}),
    ...(e.disambiguation ? { about: e.disambiguation } : {}),
    ...(e.tags.length ? { tags: e.tags.slice(0, 5).map((t) => t.name) } : {}),
  };
}

function signalIds(ctx: ToolContext): string[] {
  const ids = ctx.board.act?.signalIds ?? [];
  if (!ids.length) throw new Error("No act signal yet. Call lookup_act first.");
  return ids;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function searchOne(ctx: ToolContext, query: string, type: string, purpose: string) {
  const data = await ctx.session.get("/search", { query, types: type, take: 5 }, purpose);
  const list = entitiesFrom(data);
  const exact = list.find((e) => norm(e.name) === norm(query));
  return { exact, top: list[0], list };
}

/* ---------------------------------------------------------------- tools */

const lookupAct: RoadieTool = {
  name: "lookup_act",
  description:
    "Resolve the act (and optional 'sounds like' reference acts) to Qloo entities. Builds the taste signal every other tool uses. If the act itself is too new/small to be in Qloo, its reference acts become the signal. Always call this first.",
  parameters: {
    type: "object",
    properties: {
      act_name: { type: "string", description: "The act's name." },
      sounds_like: {
        type: "array",
        items: { type: "string" },
        description: "Up to 5 well-known acts with an overlapping fanbase.",
      },
    },
    required: ["act_name"],
  },
  label: (a) => `Looking up “${a.act_name}” in Qloo's taste graph`,
  async run(ctx, args) {
    const type = QLOO_TYPE[ctx.actType];
    const name = String(args.act_name ?? "").trim();
    const refs = (Array.isArray(args.sounds_like) ? args.sounds_like : [])
      .map(String)
      .filter(Boolean)
      .slice(0, 5);

    const [self, ...refHits] = await Promise.all([
      searchOne(ctx, name, type, `Resolve act “${name}”`),
      ...refs.map((r) => searchOne(ctx, r, type, `Resolve reference act “${r}”`)),
    ]);
    const found = self.exact;
    const references = refHits
      .map((h) => h.exact ?? h.top)
      .filter((e): e is Entity => !!e && e.id !== found?.id);
    const ids = [...(found ? [found.id] : []), ...references.map((r) => r.id)];
    ctx.board.act = { found, references, signalIds: [...new Set(ids)], qlooType: type };

    if (!ids.length) {
      return {
        summary: "No match in Qloo. Need reference acts",
        data: {
          error: "Neither the act nor any reference act was found. Ask the user for 2-5 better-known acts with a similar audience.",
          near_misses: self.list.slice(0, 3).map((e) => e.name),
        },
      };
    }
    return {
      summary: found
        ? `Found ${found.name}${references.length ? ` + ${references.length} reference acts` : ""}`
        : `Act not in Qloo; using ${references.map((r) => r.name).join(", ")} as its taste signal`,
      data: {
        act_found: found ? brief(found) : null,
        near_misses: found ? [] : self.list.slice(0, 3).map((e) => e.name),
        references: references.map(brief),
        signal_entity_count: ids.length,
      },
    };
  },
};

const profileAudience: RoadieTool = {
  name: "profile_audience",
  description:
    "Get the fanbase's demographic skew (age, gender affinity vs. average) and its cross-domain taste tags from Qloo. Use it to shape marketing angles.",
  parameters: { type: "object", properties: {} },
  label: () => "Profiling the fanbase's demographics and taste DNA",
  async run(ctx) {
    const ids = signalIds(ctx).join(",");
    const queries = TASTE_QUERIES.filter((q) => !q.acts || q.acts.includes(ctx.actType));
    const [demo, ...tagSets] = await Promise.all([
      ctx.session
        .get("/v2/insights", { "filter.type": "urn:demographics", "signal.interests.entities": ids }, "Audience age/gender affinity")
        .catch(() => null),
      ...queries.map((q) =>
        ctx.session
          .get("/v2/insights", { "filter.type": "urn:tag", "signal.interests.entities": ids, ...q.params, take: 8 }, `Fan taste: ${q.group}`)
          .then(tagsFrom)
          .catch(() => []),
      ),
    ]);
    const rows = demographicsFrom(demo);
    const avg = (key: "age" | "gender") => {
      const out: Record<string, number> = {};
      for (const r of rows)
        for (const [k, v] of Object.entries(r[key])) out[k] = (out[k] ?? 0) + v / rows.length;
      for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 100) / 100;
      return out;
    };
    const seen = new Set<string>();
    const tasteTags = queries.flatMap((q, i) =>
      tagSets[i]
        .filter((t) => {
          const k = t.name.trim().toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .slice(0, 8)
        .map((t) => ({ id: t.id, name: t.name.trim(), type: t.type, group: q.group })),
    );
    ctx.board.audience = { age: avg("age"), gender: avg("gender"), tasteTags };
    const topAge = Object.entries(ctx.board.audience.age).sort((a, b) => b[1] - a[1])[0];
    return {
      summary: topAge
        ? `Fans skew ${topAge[0].replace(/_/g, " ")}; ${tasteTags.length} taste signals`
        : `${tasteTags.length} taste signals found`,
      data: {
        age_affinity: ctx.board.audience.age,
        gender_affinity: ctx.board.audience.gender,
        taste: Object.fromEntries(queries.map((q) => [q.group, tasteTags.filter((t) => t.group === q.group).map((t) => t.name)])),
        note: "Age/gender values are relative to the average population: positive = over-indexes.",
      },
    };
  },
};

/**
 * Qloo's location affinities sit in a narrow band near 1, so rescale each signal
 * entity across the scanned cities before averaging: present = 0.25..1 by value,
 * absent (Qloo found no local resonance) = 0. Markets without per-entity data
 * (fallback method) are min-max scaled on their raw score.
 */
function rescore(markets: MarketScore[], ids: string[]): MarketScore[] {
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const scaled = markets.map((m) => {
    if (!m.perEntity) return { ...m, affinity: 0 };
    const parts = ids.map((id) => {
      const v = m.perEntity![id];
      if (v === undefined) return 0;
      const present = markets.map((x) => x.perEntity?.[id]).filter((x): x is number => x !== undefined);
      const lo = Math.min(...present);
      const hi = Math.max(...present);
      return hi - lo < 1e-9 ? 1 : 0.25 + (0.75 * (v - lo)) / (hi - lo);
    });
    return { ...m, affinity: mean(parts) };
  });
  const flat = scaled.filter((m) => !m.perEntity);
  if (flat.length) {
    const lo = Math.min(...flat.map((m) => m.raw ?? 0));
    const hi = Math.max(...flat.map((m) => m.raw ?? 0));
    for (const m of flat) m.affinity = hi - lo < 1e-9 ? 0.5 : ((m.raw ?? 0) - lo) / (hi - lo);
  }
  const sorted = scaled.sort((a, b) => b.affinity - a.affinity);
  return sorted.map((m, i) => ({ ...m, index: sorted.length > 1 ? 1 - i / (sorted.length - 1) : 1 }));
}

const scoreMarkets: RoadieTool = {
  name: "score_markets",
  description:
    "Rank candidate cities by how strongly their local audience has affinity for the act's taste signal (Qloo location-aware affinity). Omit `cities` to scan every market in the brief's region. Also returns Qloo 'wildcard' destinations the fanbase over-indexes on.",
  parameters: {
    type: "object",
    properties: {
      cities: {
        type: "array",
        items: { type: "string" },
        description: "Optional explicit list of city names to score.",
      },
    },
  },
  label: (a) =>
    Array.isArray(a.cities) && a.cities.length
      ? `Scoring fan affinity in ${a.cities.length} cities`
      : "Scanning every market in the region for fan affinity",
  async run(ctx, args) {
    const ids = signalIds(ctx);
    const region = ctx.board.brief?.region ?? "north_america";
    const requested = Array.isArray(args.cities) ? args.cities.map(String) : [];
    const unknown: string[] = [];
    const candidates: Market[] = requested.length
      ? requested.flatMap((c) => {
          const mk = findMarket(c);
          if (!mk) unknown.push(c);
          return mk ? [mk] : [];
        })
      : marketsFor(region);

    const type = ctx.board.act!.qlooType;
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

    // Primary signal: affinity of each signal entity among each city's audience.
    // Qloo omits an entity when it doesn't resonate locally, so absence counts as 0.
    let method = "location-aware affinity of the act's signal entities";
    const attempts = await Promise.all(
      candidates.map(async (mk) => {
        try {
          const data = await ctx.session.get(
            "/v2/insights",
            {
              "filter.type": type,
              "signal.location.query": mk.query,
              "filter.results.entities": ids.join(","),
              take: ids.length,
            },
            `Fan affinity in ${mk.city}`,
          );
          return { mk, byId: new Map(entitiesFrom(data).map((e) => [e.id, e.affinity ?? 0])) };
        } catch {
          // A failed call is "unknown", not "no fans": leave the city out of the ranking.
          return { mk, byId: null };
        }
      }),
    );
    const perCity = attempts.filter((a): a is { mk: Market; byId: Map<string, number> } => a.byId !== null);
    const unscored = attempts.filter((a) => a.byId === null).map((a) => a.mk.city);

    let fresh: MarketScore[] = perCity.map(({ mk, byId }) => ({
      city: mk.city,
      country: mk.country,
      lat: mk.lat,
      lng: mk.lng,
      affinity: 0,
      raw: mean([...byId.values()]),
      perEntity: Object.fromEntries(byId),
      index: 0,
      evidence: `${method} (${byId.size}/${ids.length} entities present)`,
    }));

    // If the location signal doesn't separate cities, fall back to how strongly each
    // city's own places match the fanbase's taste (also a Qloo affinity score).
    const spread = rescore(fresh, ids).map((x) => x.affinity);
    if (candidates.length > 2 && Math.max(...spread) - Math.min(...spread) < 0.02) {
      method = "taste match of each city's places to the fanbase";
      fresh = await Promise.all(
        perCity.map(async ({ mk }) => {
          const data = await ctx.session
            .get(
              "/v2/insights",
              { "filter.type": "urn:entity:place", "filter.location.query": mk.query, "signal.interests.entities": ids.join(","), take: 10 },
              `Taste match of ${mk.city}'s places`,
            )
            .catch(() => null);
          const ents = entitiesFrom(data);
          return {
            city: mk.city,
            country: mk.country,
            lat: mk.lat,
            lng: mk.lng,
            affinity: 0,
            raw: mean(ents.map((e) => e.affinity ?? 0)),
            index: 0,
            evidence: `${method} (${ents.length} places)`,
          };
        }),
      );
    }

    // Merge with earlier scans, then rescore everything on one scale.
    const byCity = new Map(ctx.board.markets.map((x) => [x.city, x]));
    for (const r of fresh) byCity.set(r.city, r);
    ctx.board.markets = rescore([...byCity.values()], ids);
    const results = ctx.board.markets.filter((x) => fresh.some((f) => f.city === x.city));

    if (!ctx.board.wildcards.length) {
      const countries = [...new Set(candidates.map((c) => c.country))];
      const dest = await ctx.session
        .get(
          "/v2/insights",
          {
            "filter.type": "urn:entity:destination",
            "signal.interests.entities": ids.join(","),
            "filter.geocode.country_code": countries.length === 1 ? countries[0] : undefined,
            take: 8,
          },
          "Destinations the fanbase over-indexes on",
        )
        .catch(() => null);
      ctx.board.wildcards = entitiesFrom(dest).slice(0, 8);
    }

    return {
      summary: results.length
        ? `Top: ${results
            .slice(0, 3)
            .map((r) => r.city)
            .join(", ")}`
        : "No markets scored",
      data: {
        method,
        ranked: results.map((r) => ({ city: r.city, country: r.country, fan_index: Math.round(r.affinity * 100), raw_affinity: round(r.raw, 4) })),
        scale: "fan_index 0-100 is relative to the other candidate cities; 0 means Qloo found no local affinity.",
        wildcard_destinations: ctx.board.wildcards.map((w) => w.name),
        ...(unknown.length ? { unsupported_cities: unknown } : {}),
        ...(unscored.length ? { unscored_cities_api_error: unscored } : {}),
      },
    };
  },
};

const scoutCity: RoadieTool = {
  name: "scout_city",
  description:
    "Deep-dive one city: the named neighbourhoods where the act's fans over-index (Qloo neighbourhood heatmap), taste-matched venues for the show, and local spots (food, bars, shops, culture) the same audience loves, useful for meet-and-greets, content shoots and flyering.",
  parameters: {
    type: "object",
    properties: { city: { type: "string" } },
    required: ["city"],
  },
  label: (a) => `Scouting ${a.city}: fan neighbourhoods, venues, local spots`,
  async run(ctx, args) {
    const ids = signalIds(ctx).join(",");
    const mk = findMarket(String(args.city));
    const city = mk?.city ?? String(args.city);
    const where = mk?.query ?? city;
    const venueTags = VENUE_TAGS[ctx.actType].join(",");

    const [hoods, venuesRaw, hangoutsRaw] = await Promise.all([
      ctx.session
        .get<HeatPoint[]>(
          "/v2/insights",
          {
            "filter.type": "urn:heatmap",
            "filter.location.query": where,
            "signal.interests.entities": ids,
            "output.heatmap.boundary": "urn:entity:locality",
          },
          `Fan neighbourhoods in ${city}`,
          { id: "hoods12", fn: (d) => neighborhoodsFrom(d).slice(0, 12) },
        )
        .catch(() => [] as HeatPoint[]),
      ctx.session
        .get(
          "/v2/insights",
          {
            "filter.type": "urn:entity:place",
            "filter.location.query": where,
            "filter.tags": venueTags,
            "operator.filter.tags": "union",
            "signal.interests.entities": ids,
            take: 8,
          },
          `Taste-matched venues in ${city}`,
        )
        .catch(() => null),
      ctx.session
        .get(
          "/v2/insights",
          {
            "filter.type": "urn:entity:place",
            "filter.location.query": where,
            "filter.exclude.tags": venueTags,
            "signal.interests.entities": ids,
            take: 8,
          },
          `Local spots ${city} fans love`,
        )
        .catch(() => null),
    ]);

    let venues = entitiesFrom(venuesRaw);
    if (!venues.length && mk) {
      const fallback = await ctx.session
        .get(
          "/search",
          {
            query: VENUE_SEARCH[ctx.actType],
            types: "urn:entity:place",
            "filter.location": `${mk.lat},${mk.lng}`,
            "filter.radius": 15,
            take: 8,
          },
          `Venue search near ${city} (fallback, not taste-ranked)`,
        )
        .catch(() => null);
      venues = entitiesFrom(fallback);
    }
    const venueIds = new Set(venues.map((v) => v.id));
    const hangouts = entitiesFrom(hangoutsRaw).filter((h) => !venueIds.has(h.id));
    const hotspots = Array.isArray(hoods) ? hoods : [];
    ctx.board.scouts[city] = { city, hotspots, venues, hangouts };

    return {
      summary: `${venues.length} venues, ${hangouts.length} local spots${
        hotspots.length ? `; fans cluster in ${hotspots.slice(0, 2).map((h) => h.name).join(", ")}` : ""
      }`,
      data: {
        city,
        fan_neighbourhoods: hotspots.slice(0, 6).map((h) => ({ name: h.name, affinity: round(h.affinity, 2) })),
        venues: venues.map(brief),
        local_spots: hangouts.map(brief),
      },
    };
  },
};

const findOpeners: RoadieTool = {
  name: "find_openers",
  description:
    "Find realistic co-bill / support acts: same-category acts whose fans overlap with this act's, capped at a popularity ceiling so they are bookable. Includes Qloo's shared-taste comparison for the best fits.",
  parameters: {
    type: "object",
    properties: {
      max_popularity: {
        type: "number",
        description:
          "0-1 popularity percentile ceiling. Default: just below the act's own popularity, or 0.9 for acts not in Qloo.",
      },
    },
  },
  label: () => "Finding support acts whose fans overlap",
  async run(ctx, args) {
    const ids = signalIds(ctx);
    const act = ctx.board.act!;
    // Support acts should be smaller than the headliner. A brand-new act (modelled via
    // its references) gets emerging acts below the 90th popularity percentile.
    const fallbackCeiling = act.found?.popularity !== undefined ? Math.max(0.5, act.found.popularity - 0.015) : 0.9;
    const ceiling = Math.min(0.995, Number(args.max_popularity) || fallbackCeiling);
    const data = await ctx.session.get(
      "/v2/insights",
      {
        "filter.type": act.qlooType,
        "signal.interests.entities": ids.join(","),
        "filter.exclude.entities": ids.join(","),
        "filter.popularity.max": round(ceiling),
        "feature.explainability": true,
        take: 12,
      },
      "Overlapping-fanbase acts under popularity ceiling",
    );
    const openers = entitiesFrom(data).slice(0, 10);

    await Promise.all(
      openers.slice(0, 3).map(async (o, i) => {
        const cmp = await ctx.session
          .get(
            "/v2/analysis/compare",
            { "a.signal.interests.entities": ids.join(","), "b.signal.interests.entities": o.id, take: 6 },
            `Shared taste: act vs ${o.name}`,
          )
          .catch(() => null);
        const overlap = [
          ...new Set(
            tagsFrom(cmp)
              .filter((t) => /genre|characteristic|theme|style/.test(t.type))
              .sort((x, y) => (y.affinity ?? 0) - (x.affinity ?? 0))
              .map((t) => t.name.trim()),
          ),
        ].slice(0, 5);
        openers[i] = { ...o, ...(overlap.length ? { overlap } : {}) } as typeof o;
      }),
    );
    ctx.board.openers = openers;
    return {
      summary: openers.length ? `${openers.slice(0, 3).map((o) => o.name).join(", ")}…` : "No openers found",
      data: {
        popularity_ceiling: round(ceiling),
        candidates: openers.map((o) => ({ ...brief(o), shared_taste: (o as { overlap?: string[] }).overlap })),
      },
    };
  },
};

const findPartners: RoadieTool = {
  name: "find_partners",
  description:
    "Find brands the fanbase over-indexes on (sponsorship, merch collabs, venue bar partners), podcasts to pitch for pre-tour interviews, and TV shows the fans love (content and ad-buy hooks).",
  parameters: { type: "object", properties: {} },
  label: () => "Finding brand partners and media to pitch",
  async run(ctx) {
    const ids = signalIds(ctx).join(",");
    const get = (type: string, take: number, purpose: string) =>
      ctx.session
        .get(
          "/v2/insights",
          { "filter.type": type, "signal.interests.entities": ids, "filter.exclude.entities": ids, take },
          purpose,
        )
        .then((d) => entitiesFrom(d).filter((e, i, all) => all.findIndex((x) => x.name === e.name) === i))
        .catch(() => [] as Entity[]);
    const [brands, podcasts, shows] = await Promise.all([
      get("urn:entity:brand", 12, "Brands the fanbase over-indexes on"),
      get("urn:entity:podcast", 8, "Podcasts the fanbase listens to"),
      get("urn:entity:tv_show", 6, "TV shows the fanbase watches"),
    ]);
    Object.assign(ctx.board, { brands, podcasts, shows });
    return {
      summary: `${brands.length} brands, ${podcasts.length} podcasts, ${shows.length} shows`,
      data: { brands: brands.map(brief), podcasts: podcasts.map(brief), tv_shows: shows.map(brief) },
    };
  },
};

const planRoute: RoadieTool = {
  name: "plan_route",
  description:
    "Turn a chosen set of cities into a routed, dated itinerary that minimises travel (nearest-neighbour + 2-opt). Pass the cities you picked from score_markets.",
  parameters: {
    type: "object",
    properties: {
      cities: { type: "array", items: { type: "string" } },
      start_city: { type: "string", description: "Optional first stop (e.g. the act's home city)." },
    },
    required: ["cities"],
  },
  label: (a) => `Routing ${Array.isArray(a.cities) ? a.cities.length : 0} stops`,
  async run(ctx, args) {
    const names = (Array.isArray(args.cities) ? args.cities : []).map(String).slice(0, 12);
    const picked = names.flatMap((n) => {
      const mk = findMarket(n);
      return mk ? [mk] : [];
    });
    if (!picked.length) return { summary: "No routable cities", data: { error: "None of those cities are supported." } };
    const startMk = args.start_city ? findMarket(String(args.start_city)) : undefined;
    const path = orderStops(
      picked.map((p) => ({ key: p.city, lat: p.lat, lng: p.lng })),
      startMk?.city,
    );
    const legs = scheduleLegs(path, ctx.board.brief?.startDate ?? new Date().toISOString().slice(0, 10));
    const prev = new Map(ctx.board.stops.map((s) => [s.city, s]));
    ctx.board.stops = path.map((p, i): Stop => {
      const mk = picked.find((x) => x.city === p.key)!;
      const score = ctx.board.markets.find((x) => x.city === mk.city);
      const scout = ctx.board.scouts[mk.city];
      const old = prev.get(mk.city);
      return {
        order: i + 1,
        city: mk.city,
        country: mk.country,
        lat: mk.lat,
        lng: mk.lng,
        date: legs[i].date,
        travel: { km: legs[i].fromKm, mode: legs[i].mode, hours: legs[i].hours },
        affinity: score?.affinity ?? 0,
        index: score?.index ?? 0,
        venue: old?.venue ?? scout?.venues[0],
        hangout: old?.hangout ?? scout?.hangouts[0],
        opener: old?.opener,
        angle: old?.angle,
      };
    });
    const totalKm = legs.reduce((s, l) => s + l.fromKm, 0);
    return {
      summary: `${path.map((p) => p.key).join(" → ")} · ${totalKm.toLocaleString()} km`,
      data: {
        itinerary: ctx.board.stops.map((s) => ({
          order: s.order,
          city: s.city,
          date: s.date,
          travel: s.travel,
          scouted: !!ctx.board.scouts[s.city],
        })),
        total_km: totalKm,
      },
    };
  },
};

const finalizePlan: RoadieTool = {
  name: "finalize_plan",
  description:
    "Commit the tour plan. Every id must come from earlier tool results; unknown ids are rejected. Call after plan_route. For each stop give the venue/opener/local-spot choice and a one-sentence city-specific marketing angle grounded in the Qloo evidence.",
  parameters: {
    type: "object",
    properties: {
      headline: { type: "string", description: "A punchy tour name/headline." },
      summary: { type: "string", description: "2-3 sentence strategy summary." },
      stops: {
        type: "array",
        items: {
          type: "object",
          properties: {
            city: { type: "string" },
            venue_id: { type: "string" },
            opener_id: { type: "string" },
            local_spot_id: { type: "string" },
            angle: { type: "string" },
          },
          required: ["city", "angle"],
        },
      },
      brand_ids: { type: "array", items: { type: "string" }, description: "Top 3 brand partners, best first." },
      podcast_ids: { type: "array", items: { type: "string" }, description: "Top 3 podcasts to pitch." },
    },
    required: ["headline", "summary", "stops"],
  },
  label: () => "Locking the plan (every pick checked against Qloo results)",
  async run(ctx, args) {
    const b = ctx.board;
    const warnings: string[] = [];
    const stops = Array.isArray(args.stops) ? (args.stops as Record<string, string>[]) : [];
    for (const s of stops) {
      const stop = b.stops.find((x) => x.city === (findMarket(s.city)?.city ?? s.city));
      if (!stop) {
        warnings.push(`${s.city} is not in the routed itinerary`);
        continue;
      }
      const scout = b.scouts[stop.city];
      if (s.venue_id) {
        const v = scout?.venues.find((x) => x.id === s.venue_id);
        if (v) stop.venue = v;
        else warnings.push(`venue ${s.venue_id} not from Qloo results for ${stop.city}`);
      }
      if (s.local_spot_id) {
        const h = scout?.hangouts.find((x) => x.id === s.local_spot_id);
        if (h) stop.hangout = h;
        else warnings.push(`local spot ${s.local_spot_id} not from Qloo results for ${stop.city}`);
      }
      if (s.opener_id) {
        const o = b.openers.find((x) => x.id === s.opener_id);
        if (o) stop.opener = o;
        else warnings.push(`opener ${s.opener_id} not from find_openers`);
      }
      if (s.angle) stop.angle = String(s.angle).slice(0, 400);
    }
    const prioritize = (list: Entity[], idsArg: unknown, label: string) => {
      const ids = Array.isArray(idsArg) ? idsArg.map(String) : [];
      const chosen = ids.flatMap((id) => {
        const e = list.find((x) => x.id === id);
        if (!e) warnings.push(`${label} ${id} not from Qloo results`);
        return e ? [e] : [];
      });
      return [...chosen, ...list.filter((x) => !chosen.includes(x))];
    };
    b.brands = prioritize(b.brands, args.brand_ids, "brand");
    b.podcasts = prioritize(b.podcasts, args.podcast_ids, "podcast");
    b.headline = String(args.headline ?? "").slice(0, 120);
    b.summary = String(args.summary ?? "").slice(0, 800);
    return {
      summary: warnings.length ? `Plan saved with ${warnings.length} rejected picks` : "Plan saved, all picks verified",
      data: { ok: true, rejected: warnings },
    };
  },
};

export const TOOLS: RoadieTool[] = [
  lookupAct,
  profileAudience,
  scoreMarkets,
  scoutCity,
  findOpeners,
  findPartners,
  planRoute,
  finalizePlan,
];

export const toolByName = (name: string) => TOOLS.find((t) => t.name === name);

