import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { QlooSession, isMockMode } from "../qloo/client";
import { REGIONS, marketsFor } from "../markets";
import type { AgentEvent, Board, Brief } from "../types";
import { TOOLS, toolByName, type ToolContext } from "./tools";

type Emit = (e: AgentEvent) => void;

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const MAX_TURNS = 24;

/** Which reasoning engine this deployment uses: Claude if keyed, else Gemini, else Autopilot. */
export function llmProvider(): { name: "claude" | "gemini"; model: string } | null {
  if (process.env.ANTHROPIC_API_KEY) return { name: "claude", model: CLAUDE_MODEL };
  if (process.env.GEMINI_API_KEY) return { name: "gemini", model: GEMINI_MODEL };
  return null;
}

const SYSTEM = `You are Roadie, an AI tour manager for independent acts (musicians, comedians, live podcasts) who can't afford a booking agent or a marketing team.

You plan tours with Qloo's cultural taste graph instead of guesswork. Every claim about where fans are, which venues fit, who to co-bill with, and which brands or media to pitch has to come from your tools; if a tool returns nothing, say so plainly rather than filling the gap.

How the tools fit together for a new tour:
- lookup_act first (act name plus its "sounds like" acts), then profile_audience and score_markets (no cities argument scans the whole region).
- Pick the cities: high fan index, a sensible route (a lone far-flung outlier needs an exceptional score), the home city if one is given.
- scout_city for every chosen city in one turn, then find_openers and find_partners together.
- plan_route with the chosen cities (start_city = home city when given), then finalize_plan. For each stop choose the venue, a support act and a local spot by id, and write a one-sentence marketing angle that names its evidence: a fan neighbourhood, a taste theme, a brand the fans over-index on. finalize_plan rejects ids that didn't come from a tool result.
- Close with a short markdown brief: the tour headline, why these cities (cite fan index numbers), the three smartest moves, and one honest limits line (Qloo measures aggregate taste affinity, not ticket demand, capacity or availability).

Room size matters: Qloo doesn't know capacities, so use the act's notes and popularity (brand-new acts belong in small rooms) when choosing between venues, and say what you assumed.

For follow-ups, call only the tools the request needs; if the itinerary changes, re-run plan_route and finalize_plan. For writing tasks (booking emails, social posts, press pitches) write directly from the plan context, using real names from it.

Be concise, warm and practical, and use the act's real name.`;

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
    audience: board.audience && { age: board.audience.age, taste: board.audience.tasteTags.map((t) => t.name) },
    top_markets: board.markets.slice(0, 12).map((m) => ({ city: m.city, fan_index: Math.round(m.affinity * 100) })),
    stops: board.stops.map((s) => ({
      order: s.order,
      city: s.city,
      date: s.date,
      venue: s.venue && { ...e(s.venue), address: s.venue.address },
      opener: e(s.opener),
      local_spot: e(s.hangout),
      fan_neighbourhoods: board.scouts[s.city]?.hotspots.slice(0, 4).map((h) => h.name),
      other_venues: board.scouts[s.city]?.venues.filter((v) => v.id !== s.venue?.id).slice(0, 4).map(e),
      angle: s.angle,
    })),
    scouted_cities: Object.keys(board.scouts),
    openers: board.openers.map(e),
    brands: board.brands.slice(0, 8).map(e),
    podcasts: board.podcasts.slice(0, 6).map(e),
    headline: board.headline,
  });
}

async function runTool(ctx: ToolContext, name: string, rawArgs: unknown, emit: Emit, callId: string) {
  const tool = toolByName(name);
  const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? (rawArgs as Record<string, unknown>) : {};
  if (!tool) return { error: `Unknown tool ${name}` };
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

/** The opening turns: a new brief, or (for follow-ups) the brief, the board and the chat so far. */
function openingTurns(input: RunInput, board: Board): { role: "user" | "assistant"; text: string }[] {
  if (!input.message) return [{ role: "user", text: briefText(input.brief) }];
  const history = (input.history ?? []).slice(-8);
  return [
    {
      role: "user",
      text: `${briefText(input.brief)}\n\nCurrent plan board (from earlier tool calls):\n${boardContext(board)}`,
    },
    { role: "assistant", text: "Got it. I have the current plan loaded." },
    ...history,
    { role: "user", text: input.message },
  ];
}

export async function runRoadie(input: RunInput, emit: Emit) {
  const session = new QlooSession((call) => emit({ type: "qloo", call }));
  const ctx: ToolContext = { session, board: input.board, actType: input.brief.actType };
  ctx.board.brief = input.brief;
  const mock = isMockMode();
  const llm = llmProvider();

  if (!llm) {
    emit({ type: "status", mode: "autopilot", mock });
    if (input.message) {
      emit({ type: "message", text: "Follow-up chat needs the LLM, which isn't configured on this deployment. The plan above was built by Autopilot." });
      return;
    }
    await autopilot(ctx, emit);
    return;
  }

  emit({ type: "status", mode: "agent", mock, model: llm.model });
  try {
    if (llm.name === "claude") await runClaude(ctx, input, emit);
    else await runGemini(ctx, input, emit);
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

/** Claude agent loop: streaming, parallel tool calls, server-side refusal fallback. */
async function runClaude(ctx: ToolContext, input: RunInput, emit: Emit) {
  const client = new Anthropic();
  const tools: Anthropic.Beta.BetaTool[] = TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Beta.BetaTool.InputSchema,
    eager_input_streaming: true,
  }));
  const messages: Anthropic.Beta.BetaMessageParam[] = openingTurns(input, ctx.board).map((t) => ({
    role: t.role,
    content: t.text,
  }));

  let jsonRetries = 0;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = client.beta.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      cache_control: { type: "ephemeral" },
      system: SYSTEM,
      tools,
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: "medium" },
      messages,
    });
    stream.on("text", (delta) => emit({ type: "delta", text: delta }));

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // Only an unparseable streamed tool input is retried; API errors propagate.
      if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
      continue;
    }

    if (message.stop_reason === "refusal") {
      emit({ type: "error", text: "The model declined this request. Try rephrasing it." });
      return;
    }
    for (const block of message.content) {
      if (block.type === "thinking" && block.thinking.trim()) emit({ type: "thought", text: block.thinking.trim() });
    }
    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");

    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }
    if (!toolUses.length) {
      emit({ type: "message", text: text || "Done." });
      return;
    }
    if (message.stop_reason === "max_tokens") throw new Error("A tool call was cut off at max_tokens.");
    if (text) emit({ type: "thought", text });

    messages.push({ role: "assistant", content: message.content });
    const results = await Promise.all(toolUses.map((tu) => runTool(ctx, tu.name, tu.input, emit, tu.id)));
    messages.push({
      role: "user",
      content: toolUses.map((tu, i) => {
        const r = results[i] as { error?: unknown } | undefined;
        return {
          type: "tool_result" as const,
          tool_use_id: tu.id,
          content: JSON.stringify(results[i] ?? null),
          ...(r && typeof r === "object" && "error" in r ? { is_error: true } : {}),
        };
      }),
    });
  }
  emit({ type: "message", text: "I hit my step limit. Here's the plan as it stands; ask me to continue any part of it." });
}

/** Gemini agent loop (alternative engine when only GEMINI_API_KEY is set). */
async function runGemini(ctx: ToolContext, input: RunInput, emit: Emit) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const contents: Content[] = openingTurns(input, ctx.board).map((t) => ({
    role: t.role === "user" ? "user" : "model",
    parts: [{ text: t.text }],
  }));

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

    const results = await Promise.all(calls.map((c, i) => runTool(ctx, c.name ?? "", c.args, emit, `g${turn}-${i}`)));
    const parts: Part[] = calls.map((c, i) => ({
      functionResponse: { id: c.id, name: c.name, response: { result: results[i] } },
    }));
    contents.push({ role: "user", parts });
  }
  emit({ type: "message", text: "I hit my step limit. Here's the plan as it stands; ask me to continue any part of it." });
}

/** Deterministic fallback: same tools, fixed order, template copy. */
async function autopilot(ctx: ToolContext, emit: Emit) {
  const b = ctx.board.brief!;
  let seq = 100;
  const call = (name: string, args: Record<string, unknown> = {}) =>
    runTool(ctx, name, args, emit, `a${++seq}`) as Promise<Record<string, unknown>>;

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
