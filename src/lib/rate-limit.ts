import "server-only";

/** Small in-memory, per-instance limiter that protects the event quota. */
const LIMITS = {
  plan: { max: Number(process.env.PLAN_LIMIT_PER_HOUR ?? 12), windowMs: 60 * 60 * 1000 },
  chat: { max: Number(process.env.CHAT_LIMIT_PER_HOUR ?? 40), windowMs: 60 * 60 * 1000 },
  search: { max: 240, windowMs: 60 * 60 * 1000 },
} as const;

const hits = new Map<string, number[]>();

export function rateLimit(ip: string, kind: keyof typeof LIMITS): string | null {
  const { max, windowMs } = LIMITS[kind];
  const key = `${kind}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    const wait = Math.ceil((windowMs - (now - recent[0])) / 60000);
    return `You've hit the demo limit. Try again in about ${wait} min.`;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value!);
  return null;
}
