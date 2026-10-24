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

function pathLength(path: Point[]) {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += haversineKm(path[i - 1], path[i]);
  return d;
}

/** Nearest-neighbour seed followed by 2-opt improvement (open path, fixed start). */
export function orderStops(points: Point[], startKey?: string): Point[] {
  if (points.length <= 2) return points;
  const remaining = [...points];
  const startIdx = Math.max(
    0,
    remaining.findIndex((p) => p.key === startKey),
  );
  const path = [remaining.splice(startIdx, 1)[0]];
  while (remaining.length) {
    const last = path[path.length - 1];
    let best = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (haversineKm(last, remaining[i]) < haversineKm(last, remaining[best])) best = i;
    }
    path.push(remaining.splice(best, 1)[0]);
  }
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < path.length - 1; i++) {
      for (let k = i + 1; k < path.length; k++) {
        const candidate = [...path.slice(0, i), ...path.slice(i, k + 1).reverse(), ...path.slice(k + 1)];
        if (pathLength(candidate) + 1e-6 < pathLength(path)) {
          path.splice(0, path.length, ...candidate);
          improved = true;
        }
      }
    }
  }
  return path;
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
