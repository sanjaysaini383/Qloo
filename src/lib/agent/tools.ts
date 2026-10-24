import "server-only";
import type { QlooSession } from "../qloo/client";
import {
  demographicsFrom,
  entitiesFrom,
  heatmapFrom,
  tagsFrom,
  type Entity,
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

const VENUE_QUERIES: Record<ActType, string[]> = {
  musician: ["music venue", "live music", "concert hall"],
  comedian: ["comedy club", "theater"],
  podcast: ["theater", "event venue", "live music"],
};

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
    const [demo, tags] = await Promise.all([
      ctx.session
        .get("/v2/insights", { "filter.type": "urn:demographics", "signal.interests.entities": ids }, "Audience age/gender affinity")
        .catch(() => null),
      ctx.session
        .get("/v2/insights", { "filter.type": "urn:tag", "signal.interests.entities": ids, take: 30 }, "Fanbase taste tags")
        .catch(() => null),
    ]);
    const rows = demographicsFrom(demo);
    const avg = (key: "age" | "gender") => {
      const out: Record<string, number> = {};
      for (const r of rows)
        for (const [k, v] of Object.entries(r[key])) out[k] = (out[k] ?? 0) + v / rows.length;
      for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 100) / 100;
      return out;
    };
    const tasteTags = tagsFrom(tags)
      .filter((t) => !/streaming_service|:audience:/.test(t.id))
      .slice(0, 20);
    ctx.board.audience = { age: avg("age"), gender: avg("gender"), tasteTags };
    const topAge = Object.entries(ctx.board.audience.age).sort((a, b) => b[1] - a[1])[0];
    return {
      summary: topAge
        ? `Fans skew ${topAge[0].replace(/_/g, " ")}; ${tasteTags.length} taste tags`
        : `${tasteTags.length} taste tags found`,
      data: {
        age_affinity: ctx.board.audience.age,
        gender_affinity: ctx.board.audience.gender,
        taste_tags: tasteTags.map((t) => `${t.name} (${t.type.split(":").slice(2).join(":")})`),
        note: "Affinity values are relative to the average population: positive = over-indexes.",
      },
    };
  },
};

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

    // Primary signal: affinity of the act's own entities among each city's audience.
    let method = "location-aware affinity of the act's signal entities";
    let scored = await Promise.all(
      candidates.map(async (mk) => {
        try {
          const data = await ctx.session.get(
            "/v2/insights",
            {
              "filter.type": type,
              "signal.location.query": mk.city,
              "filter.results.entities": ids.join(","),
              take: ids.length,
            },
            `Fan affinity in ${mk.city}`,
          );
          const ents = entitiesFrom(data);
          return { mk, affinity: mean(ents.map((e) => e.affinity ?? e.popularity ?? 0)), matched: ents.length };
        } catch {
          return { mk, affinity: 0, matched: 0 };
        }
      }),
    );

    // If the location signal doesn't separate cities, fall back to how strongly each
    // city's own places match the fanbase's taste (also a Qloo affinity score).
    const vals = scored.map((s) => s.affinity);
    if (candidates.length > 2 && Math.max(...vals) - Math.min(...vals) < 0.005) {
      method = "taste match of each city's places to the fanbase";
      scored = await Promise.all(
        candidates.map(async (mk) => {
          const data = await ctx.session
            .get(
              "/v2/insights",
              { "filter.type": "urn:entity:place", "filter.location.query": mk.city, "signal.interests.entities": ids.join(","), take: 10 },
              `Taste match of ${mk.city}'s places`,
            )
            .catch(() => null);
          const ents = entitiesFrom(data);
          return { mk, affinity: mean(ents.map((e) => e.affinity ?? 0)), matched: ents.length };
        }),
      );
    }

    const sorted = [...scored].sort((a, b) => b.affinity - a.affinity);
    const n = sorted.length;
    const results: MarketScore[] = sorted.map((s, i) => ({
      city: s.mk.city,
      country: s.mk.country,
      lat: s.mk.lat,
      lng: s.mk.lng,
      affinity: s.affinity,
      index: n > 1 ? 1 - i / (n - 1) : 1,
      evidence: `${method} (${s.matched} results)`,
    }));

    // Merge with earlier scores so follow-up scans accumulate.
    const byCity = new Map(ctx.board.markets.map((x) => [x.city, x]));
    for (const r of results) byCity.set(r.city, r);
    ctx.board.markets = [...byCity.values()].sort((a, b) => b.affinity - a.affinity);

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
        ranked: results.map((r) => ({ city: r.city, country: r.country, fan_affinity: round(r.affinity) })),
        wildcard_destinations: ctx.board.wildcards.map((w) => w.name),
        ...(unknown.length ? { unsupported_cities: unknown } : {}),
      },
    };
  },
};

const venueTagCache = new Map<ActType, string[]>();

async function venueTags(ctx: ToolContext): Promise<string[]> {
  const hit = venueTagCache.get(ctx.actType);
  if (hit) return hit;
  const lists = await Promise.all(
    VENUE_QUERIES[ctx.actType].map((q) =>
      ctx.session
        .get("/v2/tags", { "filter.query": q, take: 6 }, `Find Qloo tag for “${q}”`)
        .then(tagsFrom)
        .catch(() => []),
    ),
  );
  const ids = [
    ...new Set(
      lists
        .flat()
        .filter((t) => t.id.includes(":place") || t.type.includes(":place") || t.id.includes("category"))
        .map((t) => t.id),
    ),
  ].slice(0, 6);
  if (ids.length) venueTagCache.set(ctx.actType, ids);
  return ids;
}

const scoutCity: RoadieTool = {
  name: "scout_city",
  description:
    "Deep-dive one city: a Qloo heatmap of where the act's fans cluster, taste-matched venues for the show, and local spots (food, bars, shops) the same audience loves, useful for meet-and-greets, content shoots and flyering.",
  parameters: {
    type: "object",
    properties: { city: { type: "string" } },
    required: ["city"],
  },
  label: (a) => `Scouting ${a.city}: fan hotspots, venues, local spots`,
  async run(ctx, args) {
    const ids = signalIds(ctx).join(",");
    const mk = findMarket(String(args.city));
    const city = mk?.city ?? String(args.city);
    const tags = await venueTags(ctx);

    const [heat, venuesRaw] = await Promise.all([
      ctx.session
        .get(
          "/v2/insights",
          { "filter.type": "urn:heatmap", "filter.location.query": city, "signal.interests.entities": ids, take: 100 },
          `Fan heatmap for ${city}`,
        )
        .catch(() => null),
      tags.length
        ? ctx.session
            .get(
              "/v2/insights",
              {
                "filter.type": "urn:entity:place",
                "filter.location.query": city,
                "filter.tags": tags.join(","),
                "operator.filter.tags": "union",
                "signal.interests.entities": ids,
                take: 8,
              },
              `Taste-matched venues in ${city}`,
            )
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    let venues = entitiesFrom(venuesRaw);
    if (!venues.length && mk) {
      const fallback = await ctx.session
        .get(
          "/search",
          {
            query: VENUE_QUERIES[ctx.actType][0],
            types: "urn:entity:place",
            "filter.location": `${mk.lat},${mk.lng}`,
            "filter.radius": 15,
            take: 8,
          },
          `Venue search near ${city} (fallback)`,
        )
        .catch(() => null);
      venues = entitiesFrom(fallback);
    }

    const hangoutsRaw = await ctx.session
      .get(
        "/v2/insights",
        {
          "filter.type": "urn:entity:place",
          "filter.location.query": city,
          "signal.interests.entities": ids,
          "filter.exclude.entities": venues.map((v) => v.id).join(",") || undefined,
          take: 8,
        },
        `Local spots ${city} fans love`,
      )
      .catch(() => null);
    const hangouts = entitiesFrom(hangoutsRaw);

    const hotspots = heatmapFrom(heat)
      .sort((a, b) => b.affinity - a.affinity)
      .slice(0, 12);
    ctx.board.scouts[city] = { city, hotspots, venues, hangouts };

    return {
      summary: `${venues.length} venues, ${hangouts.length} local spots, ${hotspots.length} hotspots`,
      data: {
        city,
        fan_hotspots: hotspots.slice(0, 5).map((h) => ({ lat: round(h.lat, 4), lng: round(h.lng, 4), affinity: round(h.affinity) })),
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
        description: "0-1 popularity percentile ceiling. Default: just above the act's own popularity.",
      },
    },
  },
  label: () => "Finding support acts whose fans overlap",
  async run(ctx, args) {
    const ids = signalIds(ctx);
    const act = ctx.board.act!;
    const basePop =
      act.found?.popularity ??
      (act.references.length
        ? act.references.reduce((s, r) => s + (r.popularity ?? 0.9), 0) / act.references.length
        : 0.9);
    const ceiling = Math.min(0.995, Number(args.max_popularity) || basePop + 0.02);
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
        const overlap = [...new Set(tagsFrom(cmp).map((t) => t.name))].slice(0, 6);
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
        .then(entitiesFrom)
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

