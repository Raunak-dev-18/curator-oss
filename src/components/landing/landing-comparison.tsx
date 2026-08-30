import { Check, Cpu, Sparkles, X } from "lucide-react";

const COMPARISON_ROWS = [
  {
    feature: "Code Execution Runtime",
    cognix: "Isolated Daytona Linux container with Node 20 runtime and port mapping",
    others: "Simulated browser iframe or static mockup environment",
    highlight: true,
  },
  {
    feature: "Database & Persistence",
    cognix: "Serverless Neon PostgreSQL with Drizzle ORM and automatic migrations",
    others: "In-memory fake JSON arrays that wipe on reload",
    highlight: true,
  },
  {
    feature: "Component Refinement",
    cognix: "Bidirectional Visual Click-to-Edit DOM inspector",
    others: "Blind re-prompting and manual CSS file searching",
    highlight: true,
  },
  {
    feature: "Safety & Versioning",
    cognix: "Snapshot checkpoints with side-by-side diffs and 1-click rollback",
    others: "Destructive code overwrites without easy rollback",
    highlight: false,
  },
  {
    feature: "Full-Stack Ecosystem",
    cognix: "Full Next.js App Router, Tailwind CSS, API routes, and any npm package",
    others: "Restricted single-file or frontend-only scripts",
    highlight: false,
  },
  {
    feature: "Deployment & Portability",
    cognix: "1-click live subdomains (.cognix.app) + zero-lockin full code export",
    others: "Proprietary hosting lock-in or difficult manual extraction",
    highlight: true,
  },
];

export function LandingComparison() {
  return (
    <section className="landing-comparison-section" id="comparison">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="landing-section-badge">
            <Cpu className="size-3.5 text-indigo-400" />
            <span>Technical Architecture</span>
          </div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-[-0.035em] text-white">
            Why Cognix is fundamentally different.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/60">
            Compare traditional AI code generators with Cognix&apos;s isolated container engine.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="landing-comparison-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="py-4 px-5 text-xs font-semibold text-white/50 uppercase tracking-wider w-1/3">
                    Capability
                  </th>
                  <th className="py-4 px-5 text-xs font-bold text-indigo-300 uppercase tracking-wider bg-indigo-500/10 border-x border-indigo-500/20 w-1/3">
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-indigo-400" />
                      Cognix Full-Stack Engine
                    </span>
                  </th>
                  <th className="py-4 px-5 text-xs font-semibold text-white/40 uppercase tracking-wider w-1/3">
                    Standard AI Code Generators
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 text-xs sm:text-sm">
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition">
                    <td className="py-4 px-5 font-medium text-white">
                      {row.feature}
                    </td>
                    <td className="py-4 px-5 bg-indigo-500/[0.04] border-x border-indigo-500/20 text-white font-medium">
                      <div className="flex items-start gap-2">
                        <span className="size-4 rounded-full bg-emerald-500/20 text-emerald-400 grid place-items-center shrink-0 mt-0.5">
                          <Check className="size-3" />
                        </span>
                        <span>{row.cognix}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-white/50">
                      <div className="flex items-start gap-2">
                        <span className="size-4 rounded-full bg-rose-500/10 text-rose-400 grid place-items-center shrink-0 mt-0.5">
                          <X className="size-3" />
                        </span>
                        <span>{row.others}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
