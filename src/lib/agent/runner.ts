import "server-only";
import { GoogleGenAI, type Content, type FunctionCall, type Part } from "@google/genai";
import { QlooSession, isMockMode } from "../qloo/client";
import { REGIONS, marketsFor } from "../markets";
import type { AgentEvent, Board, Brief } from "../types";
import { TOOLS, toolByName, type ToolContext } from "./tools";

type Emit = (e: AgentEvent) => void;

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const MAX_TURNS = 24;

const SYSTEM = `You are Roadie, an AI tour manager for independent acts (musicians, comedians, live podcasts) who can't afford a booking agent or a marketing team.

You plan tours with Qloo's cultural taste graph, not guesswork. Every claim about where fans are, which venues fit, who to co-bill with, and which brands or media to pitch MUST come from your tools. Never invent venues, acts, brands, podcasts or scores. If a tool returns nothing, say so plainly.

Standard workflow for a new tour:
1. lookup_act with the act name and its "sounds like" references.
2. profile_audience.
3. score_markets (no cities argument scans the whole region).
4. Choose the N best cities. Prefer high fan affinity, but keep the route sane: avoid a lone far-flung outlier unless its affinity is exceptional, and include the home city if given.
5. scout_city for EACH chosen city (call them in parallel in one turn).
6. find_openers and find_partners (parallel).
7. plan_route with the chosen cities (start_city = home city if provided).
8. finalize_plan: for each stop pick the venue, a support act, a local spot, and write a specific marketing angle that cites the evidence (e.g. a fan hotspot, a taste tag, a brand the fans love). Reference only ids from tool results.
9. Reply with a concise markdown brief: tour headline, why these cities (with affinity numbers), the 3 smartest moves, and an honest "limits" line (Qloo measures aggregate taste affinity, not ticket demand or venue availability).

For follow-up requests, use only the tools needed, then re-run plan_route and finalize_plan if the itinerary changed. For writing tasks (pitch emails, social posts), use the board data in context and write directly.
Be concise, warm, and practical. Use the act's real name.`;

function briefText(b: Brief) {
  const region = REGIONS.find((r) => r.id === b.region)?.label ?? b.region;
  return [
    `Plan a tour.`,
    `Act: ${b.actName} (${b.actType})`,
    b.soundsLike.length ? `Sounds like / shares fans with: ${b.soundsLike.join(", ")}` : "",
    `Region: ${region} (${marketsFor(b.region).length} candidate markets)`,
    `Number of shows: ${b.shows}`,
    `First show date: ${b.startDate}`,
    b.homeCity ? `Home city: ${b.homeCity}` : "",
    b.notes ? `Notes from the act: ${b.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Board context for follow-up turns, trimmed to what the model needs. */
function boardContext(board: Board) {
  const e = (x?: { id: string; name: string }) => (x ? { id: x.id, name: x.name } : undefined);
  return JSON.stringify({
    act: board.act && {
      found: e(board.act.found),
      references: board.act.references.map(e),
    },
    audience: board.audience && { age: board.audience.age, tags: board.audience.tasteTags.map((t) => t.name) },
    top_markets: board.markets.slice(0, 12).map((m) => ({ city: m.city, affinity: Math.round(m.affinity * 1000) / 1000 })),
    stops: board.stops.map((s) => ({
      order: s.order,
      city: s.city,
      date: s.date,
      venue: e(s.venue),
      opener: e(s.opener),
      local_spot: e(s.hangout),
      angle: s.angle,
    })),
    scouted_cities: Object.keys(board.scouts),
    openers: board.openers.map(e),
    brands: board.brands.slice(0, 8).map(e),
    podcasts: board.podcasts.slice(0, 6).map(e),
    headline: board.headline,
  });
}

async function runTool(ctx: ToolContext, call: FunctionCall, emit: Emit, callId: string) {
  const tool = toolByName(call.name ?? "");
  const args = (call.args ?? {}) as Record<string, unknown>;
  if (!tool) return { error: `Unknown tool ${call.name}` };
  emit({ type: "tool", id: callId, name: tool.name, args, label: tool.label(args) });
  try {
    const res = await tool.run(ctx, args);
    emit({ type: "tool_done", id: callId, ok: true, summary: res.summary });
    emit({ type: "board", board: ctx.board });
    return res.data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit({ type: "tool_done", id: callId, ok: false, summary: msg.slice(0, 160) });
    return { error: msg.slice(0, 400) };
  }
}

export interface RunInput {
  board: Board;
  brief: Brief;
  history?: { role: "user" | "assistant"; text: string }[];
  message?: string;
}

export async function runRoadie(input: RunInput, emit: Emit) {
  const session = new QlooSession((call) => emit({ type: "qloo", call }));
  const ctx: ToolContext = { session, board: input.board, actType: input.brief.actType };
  ctx.board.brief = input.brief;
  const mock = isMockMode();

  if (!process.env.GEMINI_API_KEY) {
    emit({ type: "status", mode: "autopilot", mock });
    if (input.message) {
      emit({ type: "message", text: "Follow-up chat needs the LLM, which isn't configured on this deployment. The plan above was built by Autopilot." });
      return;
    }
    await autopilot(ctx, emit);
    return;
  }

  emit({ type: "status", mode: "agent", mock, model: GEMINI_MODEL });
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const contents: Content[] = [];
  if (input.message) {
    contents.push({
      role: "user",
      parts: [{ text: `${briefText(input.brief)}\n\nCurrent plan board (from earlier tool calls):\n${boardContext(ctx.board)}` }],
    });
    contents.push({ role: "model", parts: [{ text: "Got it. I have the current plan loaded." }] });
    for (const h of (input.history ?? []).slice(-8)) {
      contents.push({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] });
    }
    contents.push({ role: "user", parts: [{ text: input.message }] });
  } else {
    contents.push({ role: "user", parts: [{ text: briefText(input.brief) }] });
  }

  let seq = 0;
  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM,
          temperature: 0.4,
          tools: [
            {
              functionDeclarations: TOOLS.map((t) => ({
                name: t.name,
                description: t.description,
                parametersJsonSchema: t.parameters,
              })),
            },
          ],
        },
      });
      const content = res.candidates?.[0]?.content;
      if (!content?.parts?.length) throw new Error("The model returned an empty response.");
      contents.push(content);

      const calls = content.parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
      const text = content.parts
        .filter((p) => p.text && !p.thought)
        .map((p) => p.text)
        .join("")
        .trim();

      if (!calls.length) {
        emit({ type: "message", text: text || "Done." });
        return;
      }
      if (text) emit({ type: "thought", text });

      const results = await Promise.all(calls.map((c) => runTool(ctx, c, emit, `t${++seq}`)));
      const parts: Part[] = calls.map((c, i) => ({
        functionResponse: { id: c.id, name: c.name, response: { result: results[i] } },
      }));
      contents.push({ role: "user", parts });
    }
    emit({ type: "message", text: "I hit my step limit. Here's the plan as it stands; ask me to continue any part of it." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (input.message) {
      emit({ type: "error", text: `The agent hit an error: ${msg.slice(0, 200)}` });
      return;
    }
    emit({ type: "thought", text: "The LLM is unavailable right now, so Autopilot will finish the plan with the same Qloo tools." });
    emit({ type: "status", mode: "autopilot", mock });
    await autopilot(ctx, emit);
  }
}

/** Deterministic fallback: same tools, fixed order, template copy. */
async function autopilot(ctx: ToolContext, emit: Emit) {
  const b = ctx.board.brief!;
  let seq = 100;
  const call = (name: string, args: Record<string, unknown> = {}) =>
    runTool(ctx, { name, args }, emit, `a${++seq}`) as Promise<Record<string, unknown>>;

  if (!ctx.board.act?.signalIds.length) {
    const r = await call("lookup_act", { act_name: b.actName, sounds_like: b.soundsLike });
    if (r?.error) {
      emit({ type: "message", text: `I couldn't find **${b.actName}** or any reference acts in Qloo. Add 2–5 well-known acts your fans also love and try again.` });
      return;
    }
  }
  await call("profile_audience");
  await call("score_markets");
  const top = ctx.board.markets.filter((m) => m.affinity > 0);
  const home = b.homeCity ? top.find((m) => m.city.toLowerCase() === b.homeCity!.toLowerCase()) : undefined;
  const picks = [...(home ? [home] : []), ...top.filter((m) => m !== home)].slice(0, b.shows);
  if (!picks.length) {
    emit({ type: "message", text: "Qloo returned no market signal for this act in that region. Try another region or different reference acts." });
    return;
  }
  await Promise.all(picks.map((p) => call("scout_city", { city: p.city })));
  await Promise.all([call("find_openers"), call("find_partners")]);
  await call("plan_route", { cities: picks.map((p) => p.city), start_city: home?.city });

  const board = ctx.board;
  const themes = (board.audience?.tasteTags ?? []).filter((t) => t.group !== "Sound");
  const sound = (board.audience?.tasteTags ?? []).filter((t) => t.group === "Sound");
  const brands = board.brands;
  const pick = <T,>(xs: T[], i: number) => (xs.length ? xs[i % xs.length] : undefined);
  // Spread the strongest openers across the run, each playing consecutive dates.
  const openerPool = board.openers.slice(0, Math.min(3, board.openers.length));
  const perOpener = Math.max(1, Math.ceil(board.stops.length / Math.max(1, openerPool.length)));

  await call("finalize_plan", {
    headline: `${b.actName}: ${board.stops[0]?.city ?? "On"} to ${board.stops[board.stops.length - 1]?.city ?? "the Road"}`,
    summary: [
      `${board.stops.length} shows in the cities where Qloo finds the strongest local affinity for ${b.actName}'s audience, routed to the shortest drive.`,
      sound.length ? `The sound fans gravitate to: ${sound.slice(0, 3).map((t) => t.name).join(", ")}.` : "",
      themes.length ? `Lead creative with ${themes.slice(0, 2).map((t) => t.name.toLowerCase()).join(" and ")}, the themes this audience over-indexes on.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    stops: board.stops.map((s, i) => {
      const hoods = (board.scouts[s.city]?.hotspots ?? []).slice(0, 2).map((h) => h.name).filter(Boolean);
      const brand = pick(brands, i);
      const theme = pick(themes, i);
      return {
        city: s.city,
        venue_id: s.venue?.id,
        local_spot_id: s.hangout?.id,
        opener_id: openerPool[Math.floor(i / perOpener) % Math.max(1, openerPool.length)]?.id,
        angle:
          [
            hoods.length ? `Poster and street-team ${hoods.join(" and ")}, where fans cluster` : "",
            s.hangout ? `pre-show meet-up at ${s.hangout.name}` : "",
            theme ? `creative leans on "${theme.name}"` : "",
            brand ? `pitch ${brand.name} for a local co-promo` : "",
          ]
            .filter(Boolean)
            .join("; ") + ".",
      };
    }),
    brand_ids: brands.slice(0, 3).map((x) => x.id),
    podcast_ids: board.podcasts.slice(0, 3).map((x) => x.id),
  });
  const lines = board.stops.map(
    (s) =>
      `- **${s.city}** (${s.date}): fan index ${Math.round(s.affinity * 100)}${s.venue ? ` · ${s.venue.name}` : ""}${
        s.opener ? ` · with ${s.opener.name}` : ""
      }`,
  );
  const extras = [
    board.brands.length ? `**Brands to pitch:** ${board.brands.slice(0, 3).map((x) => x.name).join(", ")}` : "",
    board.podcasts.length ? `**Podcasts for pre-tour press:** ${board.podcasts.slice(0, 3).map((x) => x.name).join(", ")}` : "",
  ].filter(Boolean);
  emit({
    type: "message",
    text: [
      `**${board.headline}**`,
      board.summary,
      lines.join("\n"),
      ...extras,
      "_Limits: Qloo measures aggregate taste affinity, not ticket demand or venue availability. Confirm holds with each venue._",
    ].join("\n\n"),
  });
}
