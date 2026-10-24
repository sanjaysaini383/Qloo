/**
 * Offline stand-in for the Qloo API, used only when no QLOO_API_KEY is set
 * (local development). All names are fictional and the UI labels the run as
 * demo data. Response shapes mirror the documented Qloo responses.
 */
import { findMarket } from "../markets";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

const rand = (seed: string, i = 0) => hash(`${seed}#${i}`);
const id = (seed: string) => {
  const h = (n: number) => Math.floor(rand(seed, n) * 0xffffffff).toString(16).padStart(8, "0").toUpperCase();
  return `${h(1)}-${h(2).slice(0, 4)}-${h(3).slice(0, 4)}-${h(4).slice(0, 4)}-${h(5)}${h(6).slice(0, 4)}`;
};

const ADJ = ["Velvet", "Copper", "Neon", "Paper", "Static", "Golden", "Hollow", "Silver", "Midnight", "Wild"];
const NOUN = ["Room", "Hall", "Lantern", "Owl", "Garage", "Theatre", "Social", "Basement", "Arcade", "Parlor"];
const BRANDS = ["Fieldnote Coffee", "Loop Denim", "Kestrel Audio", "Saltwater Soda", "Northbound Outfitters", "Tidepool Records", "Kiln Ceramics", "Meadow Kombucha", "Arc Skate Co.", "Paperweight Books", "Lumen Cameras", "Riverbend Cider"];
const PODS = ["Late Night Liner Notes", "The Overdub", "Small Rooms Big Sound", "Tour Diary", "Deep Cuts Weekly", "Green Room Radio", "Feedback Loop", "Encore Hour"];
const SHOWS = ["Harbor Lights", "The Long Weekend", "Static Bloom", "Night Shift Diner", "Fern Valley", "Second Verse"];
const TAGS = ["Indie Folk", "Dream Pop", "Vinyl Collecting", "Natural Wine", "Thrift Fashion", "Film Photography", "Bedroom Pop", "Craft Beer", "Coffee Culture", "A24 Films", "Bouldering", "Zines", "Synth Pop", "Ramen", "Record Stores"];

function entity(seed: string, name: string, subtype: string, extra: Record<string, unknown> = {}) {
  return {
    name,
    entity_id: id(seed),
    type: "urn:entity",
    subtype,
    popularity: 0.55 + rand(seed, 9) * 0.44,
    query: { affinity: 0.4 + rand(seed, 8) * 0.6 },
    tags: [0, 1, 2].map((i) => {
      const t = TAGS[Math.floor(rand(seed, 20 + i) * TAGS.length)];
      return { id: `urn:tag:genre:mock:${t.toLowerCase().replace(/\W+/g, "_")}`, name: t, type: "urn:tag:genre:mock" };
    }),
    properties: { description: "Fictional demo entity (no Qloo key configured).", ...extra },
  };
}

function places(seed: string, city: string, n: number, kind: "venue" | "spot") {
  const mk = findMarket(city);
  return Array.from({ length: n }, (_, i) => {
    const s = `${seed}:${city}:${kind}:${i}`;
    const nm =
      kind === "venue"
        ? `The ${ADJ[Math.floor(rand(s, 1) * ADJ.length)]} ${NOUN[Math.floor(rand(s, 2) * NOUN.length)]}`
        : `${ADJ[Math.floor(rand(s, 3) * ADJ.length)]} ${["Café", "Noodle Bar", "Records", "Taproom", "Bookshop", "Diner"][i % 6]}`;
    return entity(s, nm, "urn:entity:place", {
      address: `${100 + Math.floor(rand(s, 4) * 900)} Mock St, ${city}`,
      geocode: { city },
      ...(mk ? { location: { lat: mk.lat + (rand(s, 5) - 0.5) * 0.08, lon: mk.lng + (rand(s, 6) - 0.5) * 0.08 } } : {}),
    });
  });
}

export async function mockQloo(path: string, p: Record<string, string>): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 120 + Math.random() * 280));
  const signal = p["signal.interests.entities"] ?? "";

  if (path === "/search") {
    const q = p.query ?? "";
    const type = (p.types ?? "urn:entity:artist").split(",")[0];
    if (type === "urn:entity:place") {
      return { results: places("search", p["filter.location"] ?? "city", 6, "venue") };
    }
    // Pretend acts with "unknown" in the name are too new to be in the graph.
    if (/unknown|new band/i.test(q)) return { results: [entity(`near:${q}`, `${q} Tribute Band`, type)] };
    return { results: [entity(`act:${q.toLowerCase()}`, q, type, { image: undefined })] };
  }

  if (path === "/v2/tags") {
    const q = p["filter.query"] ?? "";
    return {
      results: { tags: [{ id: `urn:tag:category:place:${q.replace(/\W+/g, "_")}`, name: q, type: "urn:tag:category:place" }] },
    };
  }

  if (path === "/v2/analysis/compare") {
    const s = `${p["a.signal.interests.entities"]}|${p["b.signal.interests.entities"]}`;
    return {
      results: {
        tags: [0, 1, 2, 3].map((i) => {
          const t = TAGS[Math.floor(rand(s, i) * TAGS.length)];
          return { tag_id: `urn:tag:genre:mock:${i}`, name: t, subtype: "urn:tag:genre:mock" };
        }),
      },
    };
  }

  const type = p["filter.type"];
  switch (type) {
    case "urn:demographics": {
      const s = signal;
      const v = (i: number) => Math.round((rand(s, i) - 0.45) * 100) / 100;
      return {
        results: {
          demographics: [
            {
              entity_id: s.split(",")[0],
              query: {
                age: { "24_and_younger": v(1), "25_to_29": v(2) + 0.2, "30_to_34": v(3), "35_to_44": v(4), "45_to_54": v(5) - 0.2, "55_and_older": v(6) - 0.3 },
                gender: { male: v(7) / 2, female: -v(7) / 2 },
              },
            },
          ],
        },
      };
    }
    case "urn:tag":
      return {
        results: {
          tags: TAGS.map((t, i) => ({ tag_id: `urn:tag:genre:mock:${i}`, name: t, subtype: "urn:tag:genre:mock", query: { affinity: 1 - i / 20 } })),
        },
      };
    case "urn:heatmap": {
      const mk = findMarket(p["filter.location.query"] ?? "");
      if (!mk) return { results: { heatmap: [] } };
      return {
        results: {
          heatmap: Array.from({ length: 40 }, (_, i) => {
            const s = `${signal}:${mk.city}:${i}`;
            return {
              location: { latitude: mk.lat + (rand(s, 1) - 0.5) * 0.25, longitude: mk.lng + (rand(s, 2) - 0.5) * 0.3, geohash: "mock" },
              query: { affinity: rand(s, 3), affinity_rank: rand(s, 3), popularity: rand(s, 4) },
            };
          }),
        },
      };
    }
    case "urn:entity:place": {
      const city = p["filter.location.query"] ?? "";
      const kind = p["filter.tags"] ? "venue" : "spot";
      return { results: { entities: places(signal, city, Number(p.take ?? 6), kind) } };
    }
    case "urn:entity:destination":
      return {
        results: {
          entities: ["Joshua Tree", "Big Sur", "Marfa", "Asheville", "Bend"].map((n) => entity(`${signal}:${n}`, n, "urn:entity:destination")),
        },
      };
    case "urn:entity:brand":
      return { results: { entities: BRANDS.slice(0, Number(p.take ?? 10)).map((b) => entity(`${signal}:${b}`, b, "urn:entity:brand")) } };
    case "urn:entity:podcast":
      return { results: { entities: PODS.slice(0, Number(p.take ?? 8)).map((b) => entity(`${signal}:${b}`, b, "urn:entity:podcast")) } };
    case "urn:entity:tv_show":
      return { results: { entities: SHOWS.slice(0, Number(p.take ?? 6)).map((b) => entity(`${signal}:${b}`, b, "urn:entity:tv_show")) } };
    default: {
      // Artist / person / podcast acts.
      if (p["filter.results.entities"]) {
        const city = p["signal.location.query"] ?? "";
        return {
          results: {
            entities: p["filter.results.entities"].split(",").map((eid) => ({
              ...entity(eid, "Signal act", type),
              entity_id: eid,
              query: { affinity: 0.2 + rand(`${eid}:${city}`) * 0.75 },
            })),
          },
        };
      }
      const names = ["Juniper Lane", "The Paper Kites Club", "Moth & Ember", "Saltlight", "Vera Cove", "Low Orbit", "Hazel Gray", "The Night Ferns", "Cardinal Static", "Mira Sol", "Driftwood Kids", "Ocean Avenue Choir"];
      return {
        results: {
          entities: names.slice(0, Number(p.take ?? 10)).map((n) => ({
            ...entity(`${signal}:${n}`, n, type),
            query: {
              affinity: 0.5 + rand(`${signal}:${n}`, 3) * 0.5,
              explainability: { "signal.interests.entities": signal.split(",").map((e, i) => ({ entity_id: e, score: rand(n, i) })) },
            },
          })),
        },
      };
    }
  }
}
