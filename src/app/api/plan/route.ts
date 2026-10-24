import { z } from "zod";
import { runRoadie } from "@/lib/agent/runner";
import { emptyBoard, type AgentEvent, type Board } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 300;

const BriefSchema = z.object({
  actName: z.string().trim().min(1).max(80),
  actType: z.enum(["musician", "comedian", "podcast"]),
  soundsLike: z.array(z.string().trim().min(1).max(80)).max(5).default([]),
  region: z.enum(["north_america", "uk_europe", "india", "australia_nz", "latin_america"]),
  shows: z.number().int().min(2).max(12),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  homeCity: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(500).optional(),
});

const BodySchema = z.object({
  brief: BriefSchema,
  message: z.string().trim().min(1).max(1000).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(6000) }))
    .max(20)
    .optional(),
  board: z.unknown().optional(),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid request", issues: body.error.issues.slice(0, 5) }, { status: 400 });
  }
  const limited = rateLimit(ip, body.data.message ? "chat" : "plan");
  if (limited) return Response.json({ error: limited }, { status: 429 });

  // Follow-ups carry the board back from the client; a new plan starts empty.
  const board: Board =
    body.data.message && body.data.board && typeof body.data.board === "object"
      ? { ...emptyBoard(), ...(body.data.board as Board) }
      : emptyBoard();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          /* client went away */
        }
      };
      try {
        await runRoadie(
          { board, brief: body.data.brief, message: body.data.message, history: body.data.history },
          emit,
        );
      } catch (err) {
        emit({ type: "error", text: err instanceof Error ? err.message : String(err) });
      }
      emit({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
