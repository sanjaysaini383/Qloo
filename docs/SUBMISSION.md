# Roadie: Devpost submission text

_Paste each section into the matching Devpost field._

## Tagline

An AI tour manager that uses Qloo's taste graph to tell independent acts where their fans are, which rooms to play, who to co-bill with, and which brands to pitch.

## Inspiration

Most musicians, comics and podcasters who tour are independent. They don't have a booking agent, a label marketing team or a data analyst, so tours get planned on gut feel: the same ten big cities everyone plays, venues found by search engine, support acts chosen from friends. Half-empty rooms and money-losing van tours follow.

General-purpose chatbots don't fix this. Ask one where a dream-pop band should tour and you get New York, LA and Chicago for everyone. It can't know that *this* band's fans over-index in Portland and not in Miami, that in Chicago they live around Logan Square and Wicker Park, which rooms they go to, or which brand they'd trust. Qloo can.

## What it does

You give Roadie your act (or, if you're brand new, two to five acts you sound like), a region, a number of shows and a start date. Roadie then works through the problem like a tour manager would, calling Qloo at every step:

1. **Resolves the act** in Qloo's graph. New acts are modelled through their reference acts, so they still get a data-grounded plan.
2. **Profiles the fanbase:** age and gender affinity versus the average, plus cross-domain taste DNA: the sound, the themes and mood, and what they read and watch.
3. **Scans every market in the region** and ranks cities by how strongly local audiences have affinity for the act's taste signal.
4. **Scouts each chosen city:** the named neighbourhoods where fans cluster (Qloo's neighbourhood heatmap, drawn as outlines on the map), taste-matched venues (live music, comedy or theatre), and the cafés, record stores, bookshops and bars the same fans love for meet-ups, content and flyering.
5. **Finds bookable support acts**: overlapping fanbases, capped below the headliner's popularity (emerging acts for a brand-new band), with Qloo's shared-taste comparison as evidence.
6. **Finds partners:** brands the fans over-index on (sponsorship, merch, bar deals), podcasts for pre-tour interviews, TV shows for content hooks.
7. **Routes the tour** with an exact shortest-path solver, dates with rest days after long drives, and flights for far hops.
8. **Commits the plan:** venue, support act, local spot and a city-specific marketing angle for every stop.

The result is a map, a ticket-stub itinerary, audience, partner and market-scan tabs, a printable tour sheet, and a **Receipts** tab listing every Qloo request behind the plan. After that you can keep talking to Roadie: "swap the weakest city", "draft a booking email to the Chicago venue", "write the Instagram announcement". It calls only the tools it needs and updates the plan.

## How we built it

- **Next.js 16 / React 19 / TypeScript** app deployed on Vercel. One streaming route handler (NDJSON) pushes agent events, tool progress, Qloo call receipts and plan-board updates to the browser in real time.
- **Agent:** Google Gemini in a streaming function-calling loop over eight Roadie tools. Its thought summaries appear in the activity feed and its reply streams in as it's written. It runs tools in parallel where it can (all city scouts at once), retries through rate limits, and carries follow-up chat with the current plan as context. The same tools also run under Claude when an Anthropic key is set.
- **Qloo endpoints used:** `/search`, `/v2/tags`, `/v2/analysis/compare`, and `/v2/insights` with `urn:demographics`, `urn:tag`, `urn:heatmap` (neighbourhood boundaries), `urn:entity:destination`, `urn:entity:place`, `urn:entity:artist` / `person` / `podcast`, `urn:entity:brand` and `urn:entity:tv_show`. Parameters used include `signal.location.query`, `filter.results.entities`, `filter.location.query`, `output.heatmap.boundary`, `filter.tags`, `filter.exclude.tags`, `filter.tag.types`, `filter.parents.types`, `filter.popularity.max`, `filter.exclude.entities` and `feature.explainability`. A typical plan makes 45 to 65 Qloo calls.
- **Guardrail against hallucination:** the final `finalize_plan` tool is validated server-side. The agent can only choose venues, acts, brands and podcasts whose ids Qloo actually returned; anything else is rejected and reported back to the model.
- **Autopilot fallback:** if the LLM is unavailable, a deterministic planner runs the same tools in a fixed order, so the demo never dead-ends.
- **Routing:** exact open-path travelling-salesman solver (Held-Karp dynamic programming), unit-tested against brute force.
- **Responsible API use:** server-side key, private in-memory cache, a process-wide gate under the key's 10 requests/second limit, 429-aware retries, and per-IP rate limits.

## Challenges we ran into

- Turning "where are my fans?" into numbers that compare across cities. Qloo's location-aware affinities (`signal.location.query` + `filter.results.entities`) sit in a narrow band near 1, and an entity is omitted where it doesn't resonate, so we rescale each entity across the scanned cities before averaging. A failed call leaves a city unscored instead of scoring it zero.
- Making city names mean the right place. Bare "Washington" resolved to the state and "Copenhagen, Denmark" to Copenhagen, New York, so every one of the ~80 markets carries a locality query validated against Qloo's resolver.
- Neighbourhood heatmaps return polygons for every containing area, up to whole countries (megabytes of WKT). We parse outlines without regex, drop administrative areas and far-away places, and slim the response before caching, so Chicago comes back as Logan Square, Ukrainian Village and Wicker Park.
- Venue picks: Qloo's taste ranking happily suggests museums with a stage. We re-rank toward real rooms using Qloo's own place tags and keep brand-new acts away from marquee halls.
- Brand-new acts aren't in any graph. Using weighted "sounds like" acts as the taste signal solved this and made the product useful for the people who need it most.
- Keeping an LLM agent honest: the id-validation guardrail plus the Receipts tab make every recommendation traceable.

## Accomplishments that we're proud of

- A full product, not an API demo: from a five-field brief to a routed, dated, venue-matched tour with partners and marketing angles in a single agent run.
- Every number and name on screen traces back to a specific Qloo request.
- It works for an unsigned band nobody has heard of, which is exactly who has no tour manager.

## What we learned

Cultural taste is the missing input for practical agent work. The LLM is good at sequencing and explaining; Qloo supplies the facts about what people actually love, and where.

## What's next for Roadie

- Ticketing and capacity data to turn affinity into expected attendance and break-even per show.
- One-click venue outreach with hold tracking.
- Festival-slot targeting and multi-act packages for promoters.
- A promoter mode that runs the same engine the other way round: "which acts should I book for my room?"

## Built with

nextjs, react, typescript, tailwindcss, qloo, gemini, google-genai, leaflet, vercel

## Testing instructions for judges

- Open the live demo and click any "Try" chip, or use `/?try=0` … `/?try=3`.
- Watch the agent activity panel; open **Receipts** to see every Qloo call.
- Click a stop to see the fan neighbourhoods, venues and local spots on the map, then try "Draft a booking…".
- Ask a follow-up in the chat box, for example "Swap the weakest city for a better one nearby".
- No login is needed.
