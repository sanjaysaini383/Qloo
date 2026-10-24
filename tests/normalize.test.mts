import assert from "node:assert/strict";
import { test } from "node:test";
import { demographicsFrom, entitiesFrom, heatmapFrom, tagsFrom } from "../src/lib/qloo/normalize.ts";

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
