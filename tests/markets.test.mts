import assert from "node:assert/strict";
import { test } from "node:test";
import { findMarket } from "../src/lib/markets.ts";

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
