"use client";
import { motion, type Variants } from "framer-motion";
import { ArrowDown, Database, Handshake, Layers, Lock, MapPinned, Radar, Route, ShieldCheck, Sparkles } from "lucide-react";
import type { Brief } from "@/lib/types";
import { BriefForm } from "./BriefForm";
import { GithubMark, Logo } from "./Logo";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const REPO = "https://github.com/sanjaysaini383/Qloo";

const EASE = [0.22, 1, 0.36, 1] as const;
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };

const FEATURES = [
  { icon: Radar, title: "Market scan", text: "Every city in a region ranked by your fans' affinity." },
  { icon: MapPinned, title: "City scouting", text: "Fan hotspot heatmaps, taste-matched venues, local hangouts." },
  { icon: Handshake, title: "Co-bills & partners", text: "Bookable support acts, brands and podcasts your fans love." },
  { icon: Route, title: "Routed itinerary", text: "Travel-optimised dates, angles per city, and an agent you can talk to." },
];

const PRINCIPLES = [
  {
    icon: Database,
    title: "Grounded, not guessed",
    text: "Every city score, venue, support act and brand comes from a Qloo API call you can inspect in the Receipts tab.",
  },
  {
    icon: ShieldCheck,
    title: "Guard-railed agent",
    text: "The final plan is validated server-side: the agent can only pick venues, acts and brands that Qloo actually returned.",
  },
  {
    icon: Layers,
    title: "Cross-domain taste",
    text: "Qloo links music to food, fashion, TV and podcasts, so Roadie can suggest the taproom for the meet-up and the podcast for the pre-tour interview.",
  },
  {
    icon: Lock,
    title: "Privacy-safe",
    text: "Only public act names go to Qloo. Results describe aggregate audience affinity, never individuals.",
  },
];

type Env = { qloo: string; llm: string | null } | null;

export function Landing({ env, onStart }: { env: Env; onStart: (b: Brief) => void }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-white/6 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" size="sm" className="max-sm:hidden">
              <a href="#how">How it works</a>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <a href={REPO} target="_blank" rel="noreferrer">
                <GithubMark className="size-3.5" />
                GitHub
              </a>
            </Button>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-12 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-20">
        <motion.div variants={stagger} initial="hidden" animate="show">
          <motion.div variants={fadeUp}>
            <Badge variant="default" className="py-1 pl-2">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
              </span>
              AI tour manager · powered by Qloo taste AI
            </Badge>
          </motion.div>
          <motion.h1 variants={fadeUp} className="mt-6 font-serif text-[2.9rem] leading-[1] tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Your fans are out there. <em className="box-decoration-clone bg-linear-to-r from-[#ffd88a] to-primary bg-clip-text pr-1 text-transparent">Roadie knows where.</em>
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Most independent acts book tours on gut feel and a spreadsheet. Roadie is an agent that reads Qloo&apos;s cultural taste graph to find the cities where
            your audience over-indexes, the venues and neighbourhoods they actually go to, support acts who share your fans, and the brands and podcasts worth
            pitching.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-7 lg:hidden">
            <Button asChild size="lg">
              <a href="#plan">
                Plan a tour <ArrowDown />
              </a>
            </Button>
          </motion.div>

          <motion.ul variants={stagger} className="mt-9 grid max-w-xl gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <motion.li
                key={f.title}
                variants={fadeUp}
                className="surface group rounded-2xl p-4 transition-colors hover:border-white/12 hover:bg-white/4"
              >
                <span className="mb-3 grid size-9 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <f.icon className="size-4" />
                </span>
                <div className="text-sm font-semibold">{f.title}</div>
                <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{f.text}</div>
              </motion.li>
            ))}
          </motion.ul>

          <motion.p variants={fadeUp} className="mt-6 flex max-w-xl gap-3 text-sm leading-relaxed text-muted-foreground">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <strong className="font-medium text-foreground">New act, not in any database yet?</strong> Tell Roadie who you sound like. It models your future fans
              through the acts they already love.
            </span>
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          id="plan"
          className="scroll-mt-20 lg:sticky lg:top-24"
        >
          <BriefForm onSubmit={onStart} />
          {env && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
              <Badge variant={env.qloo === "live" ? "success" : "danger"}>
                <span className={`size-1.5 rounded-full ${env.qloo === "live" ? "bg-teal-300" : "bg-rose-300"}`} />
                {env.qloo === "live" ? "Live Qloo data" : "Fictional demo data (no Qloo key)"}
              </Badge>
              <Badge>{env.llm ? `Agent · ${env.llm}` : "Autopilot planner (no LLM key)"}</Badge>
            </div>
          )}
        </motion.div>
      </section>

      <section id="how" className="scroll-mt-16 border-t border-white/6">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6, ease: EASE }}>
            <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">Why Roadie</p>
            <h2 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl">Why a plain LLM can&apos;t do this</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Ask a chatbot where an indie band should tour and you get the same ten big cities for everyone. It has no idea that your particular fans over-index in
              Minneapolis and not in Miami, which rooms they go to, or which brand they&apos;d trust.
            </p>
          </motion.div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid gap-4 sm:grid-cols-2 lg:col-span-2"
          >
            {PRINCIPLES.map((p) => (
              <motion.div key={p.title} variants={fadeUp} whileHover={{ y: -3 }} className="glass rounded-2xl p-5">
                <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/5">
                  <p.icon className="size-[18px] text-primary" />
                </span>
                <h3 className="mt-4 font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-white/6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo className="opacity-80" />
          <p className="max-w-2xl leading-relaxed sm:text-right">
            Built for the Qloo Agentic Hackathon. Taste data © Qloo. Basemap © Esri, © OpenStreetMap contributors. Open source under the MIT license.
          </p>
        </div>
      </footer>
    </div>
  );
}
