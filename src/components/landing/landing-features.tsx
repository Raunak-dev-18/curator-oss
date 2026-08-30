import { Cpu, Database, GitBranch, Globe2, MousePointer2, Zap } from "lucide-react";

export function LandingFeatures() {
  return (
    <section className="landing-features-section" id="features">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="landing-section-badge">
            <Zap className="size-3.5 text-indigo-400" />
            <span>Core Capabilities</span>
          </div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-[-0.035em] text-white">
            Engineered for real full-stack software.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/60">
            Cognix combines autonomous agent planning with real Linux sandbox execution, relational databases, and visual debugging.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 (Large - Daytona Sandboxes) */}
          <div className="md:col-span-2 landing-bento-card group">
            <div className="flex items-center justify-between">
              <div className="size-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 grid place-items-center text-indigo-400">
                <Cpu className="size-5" />
              </div>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                True Linux Isolation
              </span>
            </div>

            <div className="mt-5">
              <h3 className="text-xl font-semibold text-white tracking-tight">
                Isolated Daytona Container Sandboxes
              </h3>
              <p className="mt-2 text-sm text-white/60 leading-relaxed max-w-xl">
                Every project runs in its own dedicated Daytona container. Cognix executes real terminal commands, installs any npm package, builds Next.js App Router applications, and streams hot-reloaded dev servers securely.
              </p>
            </div>

            {/* Interactive Terminal Mockup inside Bento Card */}
            <div className="mt-6 p-4 rounded-xl bg-[#09090b] border border-white/8 font-mono text-xs text-white/70">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/8 text-[11px] text-white/40">
                <span>daytona-sandbox-ubuntu-24.04</span>
                <span className="text-emerald-400">● Container Ready</span>
              </div>
              <p className="text-white/50">$ npm install @stripe/stripe-js recharts drizzle-orm @neondatabase/serverless</p>
              <p className="text-emerald-400 mt-1">✓ Added 38 packages in 1.1s</p>
              <p className="text-indigo-300 mt-1">✓ Ready on http://localhost:3000 (mapped to secure edge tunnel)</p>
            </div>
          </div>

          {/* Card 2 (Visual Click-to-Edit) */}
          <div className="landing-bento-card group">
            <div className="size-10 rounded-xl bg-sky-500/10 border border-sky-500/20 grid place-items-center text-sky-400">
              <MousePointer2 className="size-5" />
            </div>

            <div className="mt-5">
              <h3 className="text-xl font-semibold text-white tracking-tight">
                Visual Click-to-Edit Bridge
              </h3>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">
                Click any DOM element in your live running preview. Cognix pinpoints the exact React component in code and lets you prompt refinements without manual searching.
              </p>
            </div>

            <div className="mt-6 p-3.5 rounded-xl bg-[#09090b] border border-white/8 text-xs font-mono">
              <div className="flex items-center gap-2 text-sky-300 mb-1.5">
                <span className="size-1.5 rounded-full bg-sky-400 animate-ping" />
                <span>&lt;BillingTable /&gt;</span>
              </div>
              <p className="text-white/40 text-[11px]">Hovered: src/components/billing-table.tsx</p>
            </div>
          </div>

          {/* Card 3 (Neon PostgreSQL) */}
          <div className="landing-bento-card group">
            <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 grid place-items-center text-emerald-400">
              <Database className="size-5" />
            </div>

            <div className="mt-5">
              <h3 className="text-xl font-semibold text-white tracking-tight">
                Serverless Neon PostgreSQL
              </h3>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">
                Automatic relational persistence. Cognix writes Drizzle ORM schemas, handles migrations, and stores real application data with zero external database configuration.
              </p>
            </div>

            <div className="mt-6 p-3.5 rounded-xl bg-[#09090b] border border-white/8 text-xs font-mono text-white/70">
              <span className="text-emerald-400">drizzle-kit push</span>
              <p className="text-white/40 mt-1 text-[11px]">Created tables: users, sessions, invoices (Postgres 16)</p>
            </div>
          </div>

          {/* Card 4 (Time-Travel Checkpoints & Rollback) */}
          <div className="landing-bento-card group">
            <div className="size-10 rounded-xl bg-violet-500/10 border border-violet-500/20 grid place-items-center text-violet-400">
              <GitBranch className="size-5" />
            </div>

            <div className="mt-5">
              <h3 className="text-xl font-semibold text-white tracking-tight">
                Time-Travel Checkpoints
              </h3>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">
                Every AI prompt step creates an immutable snapshot checkpoint. Inspect per-file diffs with syntax highlighting and roll back anytime with a single click.
              </p>
            </div>

            <div className="mt-6 p-3.5 rounded-xl bg-[#09090b] border border-white/8 text-xs font-mono text-white/70">
              <span className="text-violet-300">Checkpoint #12 · 2m ago</span>
              <p className="text-white/40 mt-1 text-[11px]">+42 lines · -8 lines · Instant Restore</p>
            </div>
          </div>

          {/* Card 5 (Multimodal Input & Zero Lock-in Export) */}
          <div className="landing-bento-card group">
            <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 grid place-items-center text-amber-400">
              <Globe2 className="size-5" />
            </div>

            <div className="mt-5">
              <h3 className="text-xl font-semibold text-white tracking-tight">
                1-Click Publish & Full Export
              </h3>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">
                Publish instantly to a permanent live custom subdomain (`your-app.cognix.app`) or download a clean Next.js repository with full Git history.
              </p>
            </div>

            <div className="mt-6 p-3.5 rounded-xl bg-[#09090b] border border-white/8 text-xs font-mono text-white/70">
              <span className="text-amber-300">Live Edge Deployment</span>
              <p className="text-white/40 mt-1 text-[11px]">https://your-app.cognix.app (Global Edge CDN)</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
