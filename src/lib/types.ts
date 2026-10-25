import type { Entity, HeatPoint } from "./qloo/normalize";
import type { RegionId } from "./markets";
export type { Entity, HeatPoint } from "./qloo/normalize";

export type ActType = "musician" | "comedian" | "podcast";

export interface Brief {
  actName: string;
  actType: ActType;
  soundsLike: string[];
  region: RegionId;
  shows: number;
  startDate: string;
  homeCity?: string;
  notes?: string;
}

export interface MarketScore {
  city: string;
  country: string;
  lat: number;
  lng: number;
  /** Fan index (0–1): per-entity Qloo location affinity, rescaled across candidate cities. */
  affinity: number;
  /** Mean raw Qloo affinity of the signal entities present in this city. */
  raw?: number;
  /** Raw Qloo affinity per signal entity id in this city (absent = no local resonance). */
  perEntity?: Record<string, number>;
  /** Rank-normalised version of affinity across the candidate list (0–1). */
  index: number;
  evidence: string;
}

export interface CityScout {
  city: string;
  hotspots: HeatPoint[];
  venues: Entity[];
  hangouts: Entity[];
}

export interface Stop {
  order: number;
  city: string;
  country: string;
  lat: number;
  lng: number;
  date: string;
  travel: { km: number; mode: "start" | "drive" | "fly"; hours: number };
  affinity: number;
  index: number;
  venue?: Entity;
  hangout?: Entity;
  opener?: Entity;
  angle?: string;
}

export interface AudienceProfile {
  age: Record<string, number>;
  gender: Record<string, number>;
  tasteTags: { id: string; name: string; type: string; group?: string }[];
}

export interface Opener extends Entity {
  overlap?: string[];
}

export interface Board {
  brief?: Brief;
  act?: {
    found?: Entity;
    references: Entity[];
    signalIds: string[];
    qlooType: string;
  };
  audience?: AudienceProfile;
  markets: MarketScore[];
  wildcards: Entity[];
  scouts: Record<string, CityScout>;
  openers: Opener[];
  brands: Entity[];
  podcasts: Entity[];
  shows: Entity[];
  stops: Stop[];
  headline?: string;
  summary?: string;
}

export interface QlooCallView {
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

export type AgentEvent =
  | { type: "status"; mode: "agent" | "autopilot"; mock: boolean; model?: string }
  | { type: "thought"; text: string }
  | { type: "tool"; id: string; name: string; args: Record<string, unknown>; label: string }
  | { type: "tool_done"; id: string; ok: boolean; summary: string }
  | { type: "qloo"; call: QlooCallView }
  | { type: "board"; board: Board }
  | { type: "delta"; text: string }
  | { type: "message"; text: string }
  | { type: "error"; text: string }
  | { type: "done" };

export function emptyBoard(): Board {
  return {
    markets: [],
    wildcards: [],
    scouts: {},
    openers: [],
    brands: [],
    podcasts: [],
    shows: [],
    stops: [],
  };
}
