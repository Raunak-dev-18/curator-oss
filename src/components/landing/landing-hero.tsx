"use client";

import { ArrowRight, Code2, Cpu, Database, Flame, Layers, Sparkles, Terminal, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isAuthConfigured } from "@/lib/auth0";

const STARTER_PROMPTS = [
  {
    icon: Flame,
    title: "SaaS Billing Dashboard",
    prompt: "Create a SaaS revenue dashboard with subscription analytics, MRR churn metrics, and Stripe billing tiers using Next.js and Neon Postgres.",
    category: "Full Stack",
  },
  {
    icon: Layers,
    title: "Team Kanban Workspace",
    prompt: "Build a collaborative project tracker with drag-and-drop task boards, assignees, activity logs, and real-time status updates.",
    category: "Collaboration",
  },
  {
    icon: Wand2,
    title: "AI Customer Copilot",
    prompt: "Develop an AI customer support helpdesk with live chat, ticket categorization, automated resolution summaries, and agent analytics.",
    category: "AI Agent",
  },
  {
    icon: Database,
    title: "E-Commerce & Inventory",
    prompt: "Build a modern digital product store with shopping cart, instant search filter, inventory management, and mock checkout flow.",
    category: "Commerce",
  },
];

export function LandingHero() {
  const router = useRouter();
  const [selectedPrompt, setSelectedPrompt] = useState(
    "Create a SaaS revenue dashboard with subscription analytics, MRR churn metrics, and Stripe billing tiers using Next.js and Neon Postgres."
  );

  function handleStart(promptText: string) {
    const text = promptText.trim() || selectedPrompt;
    if (isAuthConfigured) {
      const url = `/auth/login?screen_hint=signup&prompt=${encodeURIComponent(text)}`;
      router.push(url);
    } else {
      const el = document.getElementById("create-project");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  }

  return (
    <section className="landing-hero-section">
      {/* Background ambient lighting */}
      <div className="landing-hero-glow" aria-hidden="true" />
      <div className="landing-grid-overlay" aria-hidden="true" />

      <div className="relative z-10 max-w-5xl mx-auto text-center px-4 sm:px-6">
        {/* Release badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 text-indigo-300 text-xs font-medium backdrop-blur-md">
          <Sparkles className="size-3.5 text-indigo-400" />
          <span>Cognix Engine v2.0</span>
          <span className="text-white/30">|</span>
          <span className="text-white/80">Autonomous Full-Stack Workspaces</span>
        </div>

        {/* Hero headline */}
        <h1 className="mt-7 text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-[-0.04em] text-white leading-[1.08] text-balance">
          Build working software from a conversation.
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-lg lg:text-xl text-white/60 max-w-3xl mx-auto leading-relaxed text-balance">
          Describe what you want to build. Cognix provisions an isolated Daytona sandbox, writes Next.js and PostgreSQL code, and gives you a live interactive preview with visual click-to-edit.
        </p>

        {/* Interactive Prompt Playground */}
        <div id="hero-composer" className="mt-10 max-w-3xl mx-auto">
          <div className="landing-composer-card">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/8 text-xs text-white/45">
              <span className="inline-flex items-center gap-1.5 font-medium text-white/70">
                <Terminal className="size-3.5 text-indigo-400" />
                <span>Prompt to Full-Stack App</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Daytona Sandboxes Ready
              </span>
            </div>

            <div className="p-4">
              <label htmlFor="hero-prompt-input" className="sr-only">
                Prompt to build full-stack application
              </label>
              <textarea
                id="hero-prompt-input"
                className="w-full min-h-[96px] bg-transparent text-sm sm:text-base text-white placeholder-white/35 resize-none outline-none leading-relaxed"
                placeholder="Describe your full-stack app (e.g., Stripe billing dashboard with Neon DB and real-time charts)…"
                value={selectedPrompt}
                onChange={(e) => setSelectedPrompt(e.target.value)}
                maxLength={4000}
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/8">
                <div className="flex items-center gap-2 text-xs text-white/45">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-white/70">
                    <Code2 className="size-3 text-sky-400" /> Next.js 16
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-white/70">
                    <Database className="size-3 text-emerald-400" /> Neon Postgres
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-white/70">
                    <Cpu className="size-3 text-indigo-400" /> Daytona Sandbox
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleStart(selectedPrompt)}
                  className="landing-hero-build-btn"
                  aria-label="Start building app"
                >
                  <Sparkles className="size-4 text-indigo-400" />
                  <span>Build with Cognix</span>
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick preset templates */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2" aria-label="Suggested prompts">
            <span className="text-xs text-white/40 font-medium mr-1 hidden sm:inline">Try an idea:</span>
            {STARTER_PROMPTS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setSelectedPrompt(item.prompt)}
                  className={`landing-prompt-chip ${
                    selectedPrompt === item.prompt ? "is-active" : ""
                  }`}
                >
                  <Icon className="size-3 text-indigo-400" />
                  <span>{item.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick metrics bar */}
        <div className="mt-14 pt-8 border-t border-white/8 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-4xl mx-auto text-left">
          <div className="landing-metric-box">
            <strong className="font-mono text-2xl sm:text-3xl text-white font-semibold tabular-nums">&lt;3s</strong>
            <span className="text-xs text-white/50 mt-1 block">Daytona Sandbox Startup</span>
          </div>
          <div className="landing-metric-box">
            <strong className="font-mono text-2xl sm:text-3xl text-white font-semibold tabular-nums">100%</strong>
            <span className="text-xs text-white/50 mt-1 block">Linux Container Isolation</span>
          </div>
          <div className="landing-metric-box">
            <strong className="font-mono text-2xl sm:text-3xl text-white font-semibold tabular-nums">1-Click</strong>
            <span className="text-xs text-white/50 mt-1 block">Live Edge Deployment</span>
          </div>
          <div className="landing-metric-box">
            <strong className="font-mono text-2xl sm:text-3xl text-white font-semibold tabular-nums">0</strong>
            <span className="text-xs text-white/50 mt-1 block">Manual Configuration</span>
          </div>
        </div>
      </div>
    </section>
  );
}
