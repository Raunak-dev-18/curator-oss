import { Cpu, Globe2, MessageSquareCode, MousePointer2, Sparkles } from "lucide-react";

const STEPS = [
  {
    step: "01",
    title: "Prompt & Multimodal Specs",
    description:
      "Describe what you want to build in natural language. Attach UI mockups, Figma screenshots, or database schemas directly into the composer.",
    icon: MessageSquareCode,
    badge: "Multimodal Input",
    codeSnippet: `Prompt: "Build a SaaS billing dashboard with subscription analytics, Stripe tiers, and Neon Postgres."`,
    details: ["Natural language prompts", "Image & wireframe attachments", "Instant stack synthesis"],
  },
  {
    step: "02",
    title: "Autonomous Daytona Execution",
    description:
      "Cognix launches an isolated Daytona Linux container, scaffolds Next.js App Router code, installs npm dependencies, and provisions Neon PostgreSQL.",
    icon: Cpu,
    badge: "Daytona Sandboxes",
    codeSnippet: `[daytona] Initializing isolated Linux sandbox\n[daytona] Port 3000 mapped -> live dev server running`,
    details: ["Real Linux container isolation", "Automated database migrations", "Full Next.js & Node.js runtime"],
  },
  {
    step: "03",
    title: "Live Preview & Visual Click-to-Edit",
    description:
      "Interact with your live running app in real-time. Click any UI component on screen to target it and instruct the AI to restyle or refactor it instantly.",
    icon: MousePointer2,
    badge: "Visual Inspector",
    codeSnippet: `<StatCard title="MRR" /> -> Target component selected\nRefactor: "Add upward trend arrow with emerald glow"`,
    details: ["Bidirectional DOM-to-code bridge", "Real-time hot module replacement", "Zero guesswork refactoring"],
  },
  {
    step: "04",
    title: "1-Click Publish & Full Code Export",
    description:
      "Deploy your application immediately to a live custom subdomain or export clean, production-grade Next.js source code without vendor lock-in.",
    icon: Globe2,
    badge: "Global Edge",
    codeSnippet: `Deployed: https://billing.cognix.app\nExport: ZIP package with full git history`,
    details: ["Instant custom subdomains", "Zero-lockin code download", "Persistent Neon PostgreSQL data"],
  },
];

export function LandingHowItWorks() {
  return (
    <section className="landing-workflow-section" id="how-it-works">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="landing-section-badge">
            <Sparkles className="size-3.5 text-indigo-400" />
            <span>Autonomous Pipeline</span>
          </div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-[-0.035em] text-white">
            How Cognix builds software from ideas.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/60">
            From initial prompt to production deployment in four autonomous steps.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.step} className="landing-step-card group">
                <div className="flex items-center justify-between pb-4 border-b border-white/8">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xl font-bold text-indigo-400/80">
                      {step.step}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/70">
                      {step.badge}
                    </span>
                  </div>
                  <div className="size-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 grid place-items-center text-indigo-400">
                    <Icon className="size-4" />
                  </div>
                </div>

                <div className="pt-4">
                  <h3 className="text-lg font-semibold text-white tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-white/60 leading-relaxed">
                    {step.description}
                  </p>

                  {/* Code snippet block */}
                  <div className="mt-4 p-3 rounded-lg bg-black/40 border border-white/8 font-mono text-[11px] text-white/70 leading-relaxed overflow-x-auto whitespace-pre">
                    {step.codeSnippet}
                  </div>

                  {/* Details bullets */}
                  <ul className="mt-4 space-y-1.5 text-xs text-white/50">
                    {step.details.map((detail, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="size-1 rounded-full bg-indigo-400" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
