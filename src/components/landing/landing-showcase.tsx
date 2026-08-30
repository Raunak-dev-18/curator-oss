"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isAuthConfigured } from "@/lib/auth0";

type ProjectCategory = "all" | "saas" | "ai" | "commerce" | "tools";

const SHOWCASE_PROJECTS = [
  {
    id: "saas-billing",
    title: "Apex Revenue & Subscription Hub",
    category: "saas",
    description: "Enterprise billing dashboard with MRR trends, churn forecasting, team seat management, and Stripe integration.",
    gradient: "from-blue-600/30 to-indigo-600/30",
    tags: ["Next.js 16", "Neon Postgres", "Drizzle ORM", "Stripe"],
    prompt: "Build an enterprise SaaS billing and subscription portal with MRR analytics, churn metrics, and Stripe billing tiers.",
  },
  {
    id: "ai-copilot",
    title: "OmniDesk AI Customer Copilot",
    category: "ai",
    description: "Intelligent customer service desk with live conversation summarization, semantic knowledge search, and sentiment routing.",
    gradient: "from-violet-600/30 to-purple-600/30",
    tags: ["Next.js 16", "OpenAI", "Tailwind CSS", "Neon DB"],
    prompt: "Create an AI customer support helpdesk with live chat, automated ticket resolution summaries, and agent analytics.",
  },
  {
    id: "kanban-workspace",
    title: "PulseFlow Collaborative Kanban",
    category: "tools",
    description: "Real-time project tracker with drag-and-drop workflow boards, milestone Gantt views, and team activity audit feeds.",
    gradient: "from-emerald-600/30 to-teal-600/30",
    tags: ["Next.js 16", "WebSockets", "Auth0", "Daytona"],
    prompt: "Build a collaborative project tracker with drag-and-drop task boards, assignees, activity logs, and real-time status updates.",
  },
  {
    id: "modern-storefront",
    title: "Lumina Digital Store & Checkout",
    category: "commerce",
    description: "High-conversion digital goods storefront with faceted filtering, instant checkout drawer, and live inventory sync.",
    gradient: "from-amber-600/30 to-orange-600/30",
    tags: ["Next.js 16", "Neon DB", "Tailwind CSS", "Daytona"],
    prompt: "Build a modern digital product store with shopping cart, instant search filter, inventory management, and mock checkout flow.",
  },
  {
    id: "devops-incident",
    title: "KubeWatch Incident Monitoring",
    category: "tools",
    description: "Cloud infrastructure health monitor with uptime SLAs, live alert streaming, and incident runbook automation.",
    gradient: "from-sky-600/30 to-cyan-600/30",
    tags: ["Next.js 16", "Neon Postgres", "Recharts", "Auth0"],
    prompt: "Create a DevOps incident monitoring dashboard with live uptime metrics, service alerts, and incident status management.",
  },
  {
    id: "ai-doc-search",
    title: "DocuMind Vector Knowledge Base",
    category: "ai",
    description: "Developer documentation search platform with AI semantic embeddings, code example extraction, and feedback analytics.",
    gradient: "from-pink-600/30 to-rose-600/30",
    tags: ["Next.js 16", "OpenAI RAG", "Neon pgvector", "Tailwind"],
    prompt: "Build an AI documentation search portal with semantic search, code snippet highlighting, and user feedback tracking.",
  },
];

const CATEGORIES: { id: ProjectCategory; label: string }[] = [
  { id: "all", label: "All Projects" },
  { id: "saas", label: "SaaS & Dashboards" },
  { id: "ai", label: "AI & Agents" },
  { id: "commerce", label: "E-Commerce" },
  { id: "tools", label: "Developer Tools" },
];

export function LandingShowcase() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<ProjectCategory>("all");

  const filtered = SHOWCASE_PROJECTS.filter(
    (p) => activeCategory === "all" || p.category === activeCategory
  );

  function handleUsePrompt(promptText: string) {
    if (isAuthConfigured) {
      router.push(`/auth/login?screen_hint=signup&prompt=${encodeURIComponent(promptText)}`);
    } else {
      const textarea = document.getElementById("hero-prompt-input") as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.value = promptText;
        textarea.scrollIntoView({ behavior: "smooth" });
        textarea.focus();
      }
    }
  }

  return (
    <section className="landing-showcase-section" id="showcase">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="landing-section-badge">
            <Sparkles className="size-3.5 text-indigo-400" />
            <span>Built with Cognix</span>
          </div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-[-0.035em] text-white">
            Explore what developers are building.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/60">
            Real full-stack applications with databases, authentication, responsive layouts, and edge APIs.
          </p>

          {/* Category filter pills */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2" role="tablist" aria-label="Project categories">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`landing-category-tab ${activeCategory === cat.id ? "is-active" : ""}`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((project) => (
            <article key={project.id} className="landing-showcase-card group">
              {/* Card Artwork Header */}
              <div className={`landing-showcase-cover bg-gradient-to-br ${project.gradient}`}>
                <div className="flex items-center justify-between w-full">
                  <span className="size-10 rounded-xl bg-black/40 border border-white/15 grid place-items-center text-white font-bold font-mono text-base backdrop-blur-md">
                    {project.title.charAt(0)}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/50 border border-white/10 text-white/80">
                    Next.js + Postgres
                  </span>
                </div>
                <div className="mt-6">
                  <h3 className="text-base font-semibold text-white tracking-tight">
                    {project.title}
                  </h3>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex flex-col justify-between flex-1">
                <div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    {project.description}
                  </p>

                  {/* Tech stack tags */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {project.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/8 text-white/70 font-mono">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Action */}
                <div className="mt-6 pt-4 border-t border-white/8 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleUsePrompt(project.prompt)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
                  >
                    <span>Build this app</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                  <span className="text-[11px] text-white/30 font-mono">Ready to deploy</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
