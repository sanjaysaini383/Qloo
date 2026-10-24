import { QlooSession } from "@/lib/qloo/client";
import { entitiesFrom } from "@/lib/qloo/normalize";
import { rateLimit } from "@/lib/rate-limit";

const TYPES: Record<string, string> = {
  musician: "urn:entity:artist",
  comedian: "urn:entity:person",
  podcast: "urn:entity:podcast",
};

/** Act-name autocomplete backed by Qloo /search. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const type = TYPES[url.searchParams.get("type") ?? "musician"] ?? TYPES.musician;
  if (q.length < 2) return Response.json({ results: [] });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimit(ip, "search")) return Response.json({ results: [] }, { status: 429 });
  try {
    const data = await new QlooSession().get("/search", { query: q, types: type, take: 6 }, "autocomplete");
    return Response.json({
      results: entitiesFrom(data).map((e) => ({
        id: e.id,
        name: e.name,
        about: e.disambiguation,
        popularity: e.popularity,
        image: e.image,
      })),
    });
  } catch {
    return Response.json({ results: [] });
  }
}
