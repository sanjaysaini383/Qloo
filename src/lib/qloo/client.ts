import "server-only";
import { mockQloo } from "./mock";

/**
 * Thin, defensive client for the Qloo hackathon API.
 *
 * - Every call is GET with query params (the Insights API rejects JSON bodies).
 * - Responses are cached privately in memory (allowed by the hackathon FAQ).
 * - Retries are bounded (429 / 5xx only) so we never hammer the event quota.
 * - Each call is recorded in a per-run log so the UI can show its "receipts".
 */

export const QLOO_BASE_URL =
  process.env.QLOO_BASE_URL?.replace(/\/$/, "") || "https://hackathon.api.qloo.com";

export type QlooParams = Record<string, string | number | boolean | undefined | null>;

export interface QlooCallRecord {
  id: number;
  path: string;
  params: Record<string, string>;
  status: number | "error";
  ms: number;
  count: number;
  cached: boolean;
  purpose: string;
  error?: string;
}

export class QlooError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const CACHE_MAX = 2000;
const cache = new Map<string, { at: number; data: unknown }>();

function cacheGet(key: string) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.data;
}

function cacheSet(key: string, data: unknown) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, { at: Date.now(), data });
}

export function isMockMode() {
  return process.env.QLOO_MOCK === "1" || !process.env.QLOO_API_KEY;
}

function cleanParams(params: QlooParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = String(v);
  }
  return out;
}

function countResults(data: unknown): number {
  const d = data as { results?: unknown };
  const r = d?.results;
  if (Array.isArray(r)) return r.length;
  if (r && typeof r === "object") {
    for (const v of Object.values(r as Record<string, unknown>)) {
      if (Array.isArray(v)) return v.length;
    }
  }
  return 0;
}

/** A per-request session: shares a call log and a concurrency limiter. */
export class QlooSession {
  calls: QlooCallRecord[] = [];
  private seq = 0;
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(
    private onCall?: (call: QlooCallRecord) => void,
    private maxConcurrent = 6,
  ) {}

  private async slot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }

  async get<T = unknown>(path: string, params: QlooParams, purpose: string): Promise<T> {
    const clean = cleanParams(params);
    const qs = new URLSearchParams(clean).toString();
    const key = `${path}?${qs}`;
    const started = Date.now();
    const record: QlooCallRecord = {
      id: ++this.seq,
      path,
      params: clean,
      status: 200,
      ms: 0,
      count: 0,
      cached: false,
      purpose,
    };

    const finish = (data: unknown) => {
      record.ms = Date.now() - started;
      record.count = countResults(data);
      this.calls.push(record);
      this.onCall?.(record);
      return data as T;
    };

    const cached = cacheGet(key);
    if (cached !== undefined) {
      record.cached = true;
      return finish(cached);
    }

    try {
      const data = await this.slot(() =>
        isMockMode() ? mockQloo(path, clean) : fetchWithRetry(path, qs),
      );
      cacheSet(key, data);
      return finish(data);
    } catch (err) {
      record.status = err instanceof QlooError ? err.status : "error";
      record.error = err instanceof Error ? err.message : String(err);
      record.ms = Date.now() - started;
      this.calls.push(record);
      this.onCall?.(record);
      throw err;
    }
  }
}

async function fetchWithRetry(path: string, qs: string): Promise<unknown> {
  const url = `${QLOO_BASE_URL}${path}?${qs}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(url, {
        headers: { "X-Api-Key": process.env.QLOO_API_KEY!, accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.ok) return await res.json();
      const body = await res.text().catch(() => "");
      const err = new QlooError(`Qloo ${res.status}: ${body.slice(0, 300)}`, res.status);
      if (res.status !== 429 && res.status < 500) throw err;
      lastErr = err;
    } catch (err) {
      if (err instanceof QlooError && err.status !== 429 && err.status < 500) throw err;
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
