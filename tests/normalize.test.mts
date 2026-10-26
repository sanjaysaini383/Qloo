import assert from "node:assert/strict";
import { test } from "node:test";
import { affinityOf, demographicsFrom, entitiesFrom, heatmapFrom, tagsFrom, wktRing } from "../src/lib/qloo/normalize.ts";

// Shapes below follow the examples in Qloo's API reference.

test("entities: name, id, popularity, affinity and de-duplicated tags", () => {
  const [e] = entitiesFrom({
    results: {
      entities: [
        {
          name: "Everything Everywhere All at Once",
          entity_id: "F0D354AA-BA7E-49D2-8ABA-9A8250F5C852",
          subtype: "urn:entity:movie",
          popularity: 0.998,
          query: { affinity: 0.87 },
          properties: { description: "A multiverse adventure.", image: { url: "https://images.qloo.com/x.jpg" } },
          tags: [
            { id: "urn:tag:keyword:media:multiverse", name: "Multiverse", type: "urn:tag:keyword:media" },
            { id: "urn:tag:keyword:media:multiverse_2", name: "Multiverse", type: "urn:tag:keyword:media" },
          ],
        },
      ],
    },
  });
  assert.equal(e.id, "F0D354AA-BA7E-49D2-8ABA-9A8250F5C852");
  assert.equal(e.affinity, 0.87);
  assert.equal(e.popularity, 0.998);
  assert.equal(e.image, "https://images.qloo.com/x.jpg");
  assert.equal(e.tags.length, 1);
});

test("search results arrive as a bare array", () => {
  const list = entitiesFrom({ results: [{ name: "Big Thief", entity_id: "abc", popularity: 0.9 }] });
  assert.equal(list[0].name, "Big Thief");
  assert.equal(list[0].affinity, undefined);
});

test("place coordinates are read from location.lat/lon", () => {
  const [p] = entitiesFrom({
    results: { entities: [{ name: "Venue", entity_id: "v1", location: { lat: 40.7, lon: -73.9 }, properties: { address: "1 Main St" } }] },
  });
  assert.deepEqual([p.lat, p.lng, p.address], [40.7, -73.9, "1 Main St"]);
});

test("heatmap points use affinity_rank and drop bad coordinates", () => {
  const pts = heatmapFrom({
    results: {
      heatmap: [
        { location: { latitude: 40.59, longitude: -73.75, geohash: "dr5wct" }, query: { affinity: 1, affinity_rank: 0.99, popularity: 0.97 } },
        { location: {}, query: { affinity: 0.5 } },
      ],
    },
  });
  assert.equal(pts.length, 1);
  assert.equal(pts[0].affinity, 0.99);
});

test("demographics and tags", () => {
  const [d] = demographicsFrom({
    results: { demographics: [{ entity_id: "x", query: { age: { "25_to_29": 0.43 }, gender: { male: 0.08, female: -0.08 } } }] },
  });
  assert.equal(d.age["25_to_29"], 0.43);
  const tags = tagsFrom({ results: { tags: [{ tag_id: "urn:tag:genre:media:comedy", name: "Comedy", subtype: "urn:tag:genre:media" }] } });
  assert.deepEqual(tags[0], { id: "urn:tag:genre:media:comedy", name: "Comedy", type: "urn:tag:genre:media", affinity: undefined });
});

test("neighbourhoods: drop admin areas, far points and huge regions; keep names", async () => {
  const { neighborhoodsFrom } = await import("../src/lib/qloo/normalize.ts");
  const sq = (lng: number, lat: number, d: number) =>
    `POLYGON ((${lng - d} ${lat - d}, ${lng + d} ${lat - d}, ${lng + d} ${lat + d}, ${lng - d} ${lat + d}, ${lng - d} ${lat - d}))`;
  const hoods = neighborhoodsFrom(
    {
      results: {
        entities: [
          { name: "Logan Square", query: { affinity: 1 }, boundary: sq(-87.7, 41.92, 0.01) },
          { name: "Cook County", query: { affinity: 0.99 }, boundary: sq(-87.7, 41.9, 0.01) },
          { name: "Mansion House ED", query: { affinity: 0.98 }, boundary: sq(-87.7, 41.9, 0.01) },
          { name: "59", query: { affinity: 0.98 }, boundary: sq(-87.7, 41.9, 0.01) },
          { name: "Illinois", query: { affinity: 0.97 }, boundary: sq(-89, 40, 3) },
          { name: "Faraway", query: { affinity: 0.96 }, boundary: "POINT (-80 40)" },
          { name: "Wicker Park", query: { affinity: 0.95 }, boundary: "POINT (-87.677 41.908)" },
          { name: "Huge", query: { affinity: 0.94 }, boundary: "POLYGON ((" + "1 1, ".repeat(50_000) + "1 1))" },
        ],
      },
    },
    { lat: 41.88, lng: -87.63 },
  );
  assert.deepEqual(hoods.map((h) => h.name), ["Logan Square", "Wicker Park"]);
  assert.ok(hoods[0].polygon && hoods[0].polygon.length >= 4);
  assert.equal(hoods[1].polygon, undefined);
});

test("wktRing reads points, polygons and the first ring of a multipolygon", () => {
  assert.deepEqual(wktRing("POINT(-87.65 41.92)"), [[-87.65, 41.92]]);
  assert.deepEqual(wktRing("POLYGON((-87.7 41.9, -87.6 41.9, -87.6 42, -87.7 41.9))"), [
    [-87.7, 41.9],
    [-87.6, 41.9],
    [-87.6, 42],
    [-87.7, 41.9],
  ]);
  assert.deepEqual(wktRing("MULTIPOLYGON(((1 2, 3 4, 5 6, 1 2)),((10 20, 30 40, 50 60, 10 20)))"), [
    [1, 2],
    [3, 4],
    [5, 6],
    [1, 2],
  ]);
});

test("wktRing returns nothing for empty or truncated geometry", () => {
  assert.deepEqual(wktRing(""), []);
  assert.deepEqual(wktRing("POLYGON EMPTY"), []);
  assert.deepEqual(wktRing("POLYGON((1 2, 3 4"), []);
});

test("affinityOf prefers the query affinity and skips values that aren't numbers", () => {
  assert.equal(affinityOf({ query: { affinity: 0.9, score: 0.1 }, affinity: 0.5 }), 0.9);
  assert.equal(affinityOf({ query: { affinity_rank: 0.7 } }), 0.7);
  assert.equal(affinityOf({ query: { affinity: "0.9" }, affinity: 0.5 }), 0.5);
  assert.equal(affinityOf({ query: { affinity: Number.NaN, score: 0.3 } }), 0.3);
  assert.equal(affinityOf({}), undefined);
  assert.equal(affinityOf(null), undefined);
});
