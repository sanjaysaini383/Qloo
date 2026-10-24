import assert from "node:assert/strict";
import { test } from "node:test";
import { haversineKm, orderStops, scheduleLegs } from "../src/lib/routing.ts";

const CITIES: Record<string, [number, number]> = {
  Chicago: [41.8781, -87.6298],
  Boston: [42.3601, -71.0589],
  Miami: [25.7617, -80.1918],
  "St. Louis": [38.627, -90.1994],
  Austin: [30.2672, -97.7431],
  "San Diego": [32.7157, -117.1611],
};
const points = Object.entries(CITIES).map(([key, [lat, lng]]) => ({ key, lat, lng }));
const length = (p: typeof points) => p.slice(1).reduce((s, x, i) => s + haversineKm(p[i], x), 0);

function bruteForce(start: string) {
  const rest = points.filter((p) => p.key !== start);
  const first = points.find((p) => p.key === start)!;
  let best = Infinity;
  const permute = (path: typeof points, left: typeof points) => {
    if (!left.length) best = Math.min(best, length(path));
    left.forEach((p, i) => permute([...path, p], [...left.slice(0, i), ...left.slice(i + 1)]));
  };
  permute([first], rest);
  return best;
}

test("haversine matches a known distance", () => {
  const km = haversineKm({ lat: 40.7128, lng: -74.006 }, { lat: 34.0522, lng: -118.2437 });
  assert.ok(Math.abs(km - 3936) < 15, `NYC-LA was ${km}`);
});

test("route with a fixed start is optimal and starts there", () => {
  const route = orderStops(points, "Chicago");
  assert.equal(route[0].key, "Chicago");
  assert.equal(new Set(route.map((r) => r.key)).size, points.length);
  assert.ok(Math.abs(length(route) - bruteForce("Chicago")) < 1e-6);
});

test("route without a start picks the best one", () => {
  const route = orderStops(points);
  const best = Math.min(...points.map((p) => bruteForce(p.key)));
  assert.ok(Math.abs(length(route) - best) < 1e-6);
});

test("schedule adds a rest day after long legs and flies far hops", () => {
  const legs = scheduleLegs(orderStops(points, "Chicago"), "2026-12-01");
  assert.equal(legs[0].mode, "start");
  assert.equal(legs[0].date, "2026-12-01");
  for (let i = 1; i < legs.length; i++) {
    const gap = (Date.parse(legs[i].date) - Date.parse(legs[i - 1].date)) / 86_400_000;
    assert.equal(gap, legs[i].hours > 7 ? 2 : 1);
    assert.equal(legs[i].mode, legs[i].fromKm > 900 ? "fly" : "drive");
  }
});
