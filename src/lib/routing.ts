/** Tour routing: order stops to minimise travel, then lay out dates. */

export interface Point {
  key: string;
  lat: number;
  lng: number;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Shortest open path through all stops (exact Held-Karp DP; tours are ≤12 stops).
 * If startKey is given the path begins there, otherwise the best start is chosen.
 */
export function orderStops(points: Point[], startKey?: string): Point[] {
  const n = points.length;
  if (n <= 2) return points;
  const dist = points.map((a) => points.map((b) => haversineKm(a, b)));
  const full = (1 << n) - 1;
  const cost = new Float64Array((1 << n) * n).fill(Infinity);
  const parent = new Int8Array((1 << n) * n).fill(-1);
  const fixed = points.findIndex((p) => p.key === startKey);
  for (let i = 0; i < n; i++) if (fixed < 0 || i === fixed) cost[(1 << i) * n + i] = 0;
  for (let mask = 1; mask <= full; mask++) {
    for (let last = 0; last < n; last++) {
      const c = cost[mask * n + last];
      if (!(mask & (1 << last)) || c === Infinity) continue;
      for (let next = 0; next < n; next++) {
        if (mask & (1 << next)) continue;
        const m2 = mask | (1 << next);
        const c2 = c + dist[last][next];
        if (c2 < cost[m2 * n + next]) {
          cost[m2 * n + next] = c2;
          parent[m2 * n + next] = last;
        }
      }
    }
  }
  let last = 0;
  for (let i = 1; i < n; i++) if (cost[full * n + i] < cost[full * n + last]) last = i;
  const order: number[] = [];
  for (let mask = full; last >= 0; ) {
    order.push(last);
    const prev = parent[mask * n + last];
    mask &= ~(1 << last);
    last = prev;
  }
  return order.reverse().map((i) => points[i]);
}

export interface Leg {
  fromKm: number;
  mode: "start" | "drive" | "fly";
  hours: number;
  date: string;
}

/** Assign show dates: one show per day, plus a rest/travel day after long legs. */
export function scheduleLegs(path: Point[], startDate: string): Leg[] {
  const legs: Leg[] = [];
  const d = new Date(`${startDate}T12:00:00Z`);
  path.forEach((p, i) => {
    if (i === 0) {
      legs.push({ fromKm: 0, mode: "start", hours: 0, date: d.toISOString().slice(0, 10) });
      return;
    }
    const km = haversineKm(path[i - 1], p);
    const fly = km > 900;
    const hours = fly ? Math.round((km / 750 + 3) * 10) / 10 : Math.round((km / 80) * 10) / 10;
    d.setUTCDate(d.getUTCDate() + (hours > 7 ? 2 : 1));
    legs.push({ fromKm: Math.round(km), mode: fly ? "fly" : "drive", hours, date: d.toISOString().slice(0, 10) });
  });
  return legs;
}
