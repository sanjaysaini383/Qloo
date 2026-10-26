import assert from "node:assert/strict";
import { test } from "node:test";
import { MARKETS, REGIONS, findMarket, marketsFor } from "../src/lib/markets.ts";

test("findMarket resolves boroughs, nicknames and local spellings", () => {
  const cases: Record<string, string> = {
    Brooklyn: "New York",
    "Brooklyn, NY": "New York",
    NYC: "New York",
    "Portland, OR": "Portland",
    Bangalore: "Bengaluru",
    "New Delhi": "Delhi",
    Bogota: "Bogotá",
    "sao paulo": "São Paulo",
    Köln: "Cologne",
    "Washington, D.C.": "Washington",
  };
  for (const [input, city] of Object.entries(cases)) assert.equal(findMarket(input)?.city, city, input);
});

test("findMarket returns nothing for cities outside the market list", () => {
  assert.equal(findMarket("Reykjavik"), undefined);
});

test("every region has markets and marketsFor covers the whole list", () => {
  for (const r of REGIONS) {
    const list = marketsFor(r.id);
    assert.ok(list.length >= 5, `${r.label} has only ${list.length} markets`);
    assert.ok(list.every((m) => m.region === r.id));
  }
  assert.equal(
    REGIONS.reduce((n, r) => n + marketsFor(r.id).length, 0),
    MARKETS.length,
  );
});

test("markets are unique, placed on the map and carry a Qloo query", () => {
  const names = MARKETS.map((m) => m.city);
  assert.equal(new Set(names).size, names.length, "duplicate city names");
  for (const m of MARKETS) {
    assert.ok(Math.abs(m.lat) <= 90 && Math.abs(m.lng) <= 180, `${m.city} has bad coordinates`);
    assert.ok(m.query.trim().length > 0, `${m.city} has no locality query`);
    assert.equal(findMarket(m.city)?.city, m.city, `${m.city} doesn't resolve to itself`);
  }
});
