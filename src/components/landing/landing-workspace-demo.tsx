"use client";

import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Eye,
  FileCode2,
  GitCommit,
  Monitor,
  MousePointer2,
  RotateCcw,
  Sparkles,
  Smartphone,
  Tablet,
  Terminal,
} from "lucide-react";
import { useState } from "react";

type DemoTab = "preview" | "code" | "visual-edit" | "diff";
type DemoDevice = "desktop" | "tablet" | "mobile";

export function LandingWorkspaceDemo() {
  const [activeTab, setActiveTab] = useState<DemoTab>("preview");
  const [device, setDevice] = useState<DemoDevice>("desktop");
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState("30d");

  return (
    <section className="landing-demo-section" id="demo">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section title */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="landing-section-badge">
            <Eye className="size-3.5 text-indigo-400" />
            <span>Interactive Simulator</span>
          </div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-[-0.035em] text-white">
            See the Cognix Workspace in action.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/60">
            A full-stack IDE, live hot-reloaded browser preview, and visual click-to-edit inspector—all powered by Daytona Linux sandboxes.
          </p>
        </div>

        {/* Workspace Shell */}
        <div className="landing-demo-window">
          {/* Top Window Chrome */}
          <div className="landing-demo-header">
            {/* Window control dots */}
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-red-500/80" />
              <span className="size-3 rounded-full bg-amber-500/80" />
              <span className="size-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] text-white/70 font-mono">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                billing-dashboard.cognix.app
              </span>
            </div>

            {/* Mode switcher tabs */}
            <div className="landing-demo-tabs" role="tablist" aria-label="Workspace view modes">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "preview"}
                onClick={() => setActiveTab("preview")}
                className={`landing-demo-tab ${activeTab === "preview" ? "is-active" : ""}`}
              >
                <Monitor className="size-3.5" />
                <span>Live Preview</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "code"}
                onClick={() => setActiveTab("code")}
                className={`landing-demo-tab ${activeTab === "code" ? "is-active" : ""}`}
              >
                <Code2 className="size-3.5" />
                <span>Code Workbench</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "visual-edit"}
                onClick={() => setActiveTab("visual-edit")}
                className={`landing-demo-tab ${activeTab === "visual-edit" ? "is-active" : ""}`}
              >
                <MousePointer2 className="size-3.5" />
                <span>Visual Click-to-Edit</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "diff"}
                onClick={() => setActiveTab("diff")}
                className={`landing-demo-tab ${activeTab === "diff" ? "is-active" : ""}`}
              >
                <GitCommit className="size-3.5" />
                <span>Checkpoints & Diff</span>
              </button>
            </div>

            {/* Device responsive preview selector */}
            <div className="hidden lg:flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setDevice("desktop")}
                className={`p-1.5 rounded text-white/50 hover:text-white transition ${device === "desktop" ? "bg-white/10 text-white" : ""}`}
                aria-label="Desktop viewport"
              >
                <Monitor className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDevice("tablet")}
                className={`p-1.5 rounded text-white/50 hover:text-white transition ${device === "tablet" ? "bg-white/10 text-white" : ""}`}
                aria-label="Tablet viewport"
              >
                <Tablet className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDevice("mobile")}
                className={`p-1.5 rounded text-white/50 hover:text-white transition ${device === "mobile" ? "bg-white/10 text-white" : ""}`}
                aria-label="Mobile viewport"
              >
                <Smartphone className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Main workspace layout: Split between Agent Activity Stream & Viewport */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[520px] bg-[#0c0c0d]">
            {/* Left Column: Autonomous Agent Activity Feed */}
            <div className="lg:col-span-4 border-r border-white/8 p-4 flex flex-col justify-between bg-[#0e0e10]/90">
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/8">
                  <span className="text-xs font-semibold text-white/80 flex items-center gap-2">
                    <Sparkles className="size-3.5 text-indigo-400" />
                    Autonomous Agent
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    Daytona Active
                  </span>
                </div>

                {/* Agent activity steps */}
                <div className="space-y-3 font-mono text-[11px]">
                  <div className="flex items-start gap-2 text-white/80">
                    <CheckCircle2 className="size-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-white">Initialized Daytona Linux Workspace</p>
                      <p className="text-white/40 text-[10px]">Port 3000 mapped • Node.js v20.18</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-white/80">
                    <CheckCircle2 className="size-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-white">Generated Next.js App Router Stack</p>
                      <p className="text-white/40 text-[10px]">Created src/app, components, & api routes</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-white/80">
                    <CheckCircle2 className="size-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-white">Configured Neon PostgreSQL DB</p>
                      <p className="text-white/40 text-[10px]">Schema migrated: users, plans, invoices</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-white/80">
                    <CheckCircle2 className="size-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-white">Hot Reloaded Live Preview</p>
                      <p className="text-white/40 text-[10px]">Compiled in 1,240ms • 0 TypeScript errors</p>
                    </div>
                  </div>
                </div>

                {/* Prompt refinement preview */}
                <div className="mt-6 p-3 rounded-xl bg-white/[0.03] border border-white/8">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-white/40 block mb-1.5">
                    Active User Prompt
                  </span>
                  <p className="text-xs text-white/80 font-sans leading-relaxed">
                    &quot;Add an interactive MRR growth chart with 30d/90d toggles, subscription churn metrics, and a recent invoice transaction table.&quot;
                  </p>
                </div>
              </div>

              {/* Terminal status bar */}
              <div className="mt-4 pt-3 border-t border-white/8 flex items-center justify-between text-[11px] text-white/40 font-mono">
                <span className="inline-flex items-center gap-1.5">
                  <Terminal className="size-3 text-indigo-400" />
                  <span>next dev --turbo</span>
                </span>
                <span className="text-emerald-400 font-semibold">200 OK</span>
              </div>
            </div>

            {/* Right Column: Dynamic Viewport based on selected tab */}
            <div className="lg:col-span-8 p-4 sm:p-6 flex flex-col justify-center items-center bg-[#09090b] overflow-hidden">
              <div
                className={`w-full transition-all duration-300 ${
                  device === "mobile"
                    ? "max-w-[360px]"
                    : device === "tablet"
                    ? "max-w-[620px]"
                    : "max-w-full"
                }`}
              >
                {/* 1. LIVE PREVIEW TAB */}
                {activeTab === "preview" && (
                  <div className="rounded-xl border border-white/10 bg-[#121214] p-5 shadow-2xl text-white">
                    {/* App mockup header */}
                    <div className="flex items-center justify-between pb-4 border-b border-white/8">
                      <div>
                        <h3 className="text-base font-semibold text-white">Revenue & Subscriptions</h3>
                        <p className="text-xs text-white/50">Real-time metrics from Neon Postgres</p>
                      </div>
                      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-md text-xs">
                        {["7d", "30d", "90d"].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setSelectedTimeframe(t)}
                            className={`px-2 py-0.5 rounded transition ${
                              selectedTimeframe === t ? "bg-indigo-600 text-white font-medium" : "text-white/50 hover:text-white"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Metric Cards Grid */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-white/[0.03] border border-white/8">
                        <span className="text-[11px] text-white/50 block">Monthly Recurring Revenue</span>
                        <strong className="text-xl font-bold font-mono mt-1 block tabular-nums">$48,290</strong>
                        <span className="text-[10px] text-emerald-400 font-medium mt-1 inline-flex items-center gap-0.5">
                          +14.2% vs last month
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.03] border border-white/8">
                        <span className="text-[11px] text-white/50 block">Active Subscribers</span>
                        <strong className="text-xl font-bold font-mono mt-1 block tabular-nums">1,429</strong>
                        <span className="text-[10px] text-emerald-400 font-medium mt-1 inline-flex items-center gap-0.5">
                          +86 new this week
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.03] border border-white/8">
                        <span className="text-[11px] text-white/50 block">Net Churn Rate</span>
                        <strong className="text-xl font-bold font-mono mt-1 block tabular-nums">0.82%</strong>
                        <span className="text-[10px] text-emerald-400 font-medium mt-1 inline-flex items-center gap-0.5">
                          -0.3% improvement
                        </span>
                      </div>
                    </div>

                    {/* Interactive Mock Chart Sparkline */}
                    <div className="mt-4 p-3.5 rounded-lg bg-white/[0.02] border border-white/8">
                      <div className="flex items-center justify-between text-xs mb-3 text-white/60">
                        <span>Revenue Growth Trajectory ({selectedTimeframe})</span>
                        <span className="font-mono text-emerald-400 font-semibold">$1,610 / day avg</span>
                      </div>
                      <div className="h-20 flex items-end gap-1.5 pt-2">
                        {[40, 52, 48, 65, 59, 72, 68, 85, 78, 92, 88, 100].map((val, idx) => (
                          <div
                            key={idx}
                            className="flex-1 bg-gradient-to-t from-indigo-600/30 to-indigo-500 rounded-t transition-all hover:bg-indigo-400 cursor-pointer"
                            style={{ height: `${val}%` }}
                            title={`Day ${idx + 1}: $${(val * 480).toLocaleString()}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Recent Transactions List */}
                    <div className="mt-4">
                      <span className="text-xs font-semibold text-white/70 block mb-2">Recent Invoices</span>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between p-2 rounded bg-white/[0.02] border border-white/5">
                          <span className="font-mono text-white/80">Acme Corp · Enterprise Tier</span>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-white font-semibold">$2,400.00</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-medium">Paid</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-white/[0.02] border border-white/5">
                          <span className="font-mono text-white/80">Starlight Labs · Pro Team</span>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-white font-semibold">$480.00</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-medium">Paid</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. CODE WORKBENCH TAB */}
                {activeTab === "code" && (
                  <div className="rounded-xl border border-white/10 bg-[#141416] overflow-hidden text-xs font-mono shadow-2xl">
                    {/* Code tabbar */}
                    <div className="flex items-center justify-between px-3 py-2 bg-[#0e0e10] border-b border-white/8">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 text-white font-medium">
                          <FileCode2 className="size-3 text-sky-400" />
                          app/api/metrics/route.ts
                        </span>
                        <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 text-white/40 hover:text-white">
                          <FileCode2 className="size-3 text-indigo-400" />
                          components/revenue-chart.tsx
                        </span>
                      </div>
                      <span className="text-[10px] text-white/40">TypeScript · UTF-8</span>
                    </div>

                    {/* Code content with line numbers */}
                    <div className="p-4 grid grid-cols-[36px_1fr] gap-3 text-white/80 leading-relaxed max-h-[380px] overflow-y-auto">
                      <div className="text-white/20 select-none text-right pr-2 border-r border-white/8">
                        {Array.from({ length: 14 }).map((_, i) => (
                          <div key={i}>{i + 1}</div>
                        ))}
                      </div>
                      <div className="overflow-x-auto whitespace-pre font-mono">
                        <span className="text-violet-400">import</span> &#123; NextResponse &#125; <span className="text-violet-400">from</span> <span className="text-emerald-300">&quot;next/server&quot;</span>;<br />
                        <span className="text-violet-400">import</span> &#123; db &#125; <span className="text-violet-400">from</span> <span className="text-emerald-300">&quot;@/lib/db&quot;</span>;<br />
                        <span className="text-violet-400">import</span> &#123; subscriptions, invoices &#125; <span className="text-violet-400">from</span> <span className="text-emerald-300">&quot;@/lib/schema&quot;</span>;<br />
                        <br />
                        <span className="text-violet-400">export async function</span> <span className="text-sky-300">GET</span>() &#123;<br />
                        &nbsp;&nbsp;<span className="text-violet-400">const</span> metrics = <span className="text-violet-400">await</span> db.select().from(subscriptions);<br />
                        &nbsp;&nbsp;<span className="text-violet-400">const</span> mrr = metrics.reduce((acc, sub) =&gt; acc + sub.amount, <span className="text-amber-300">0</span>);<br />
                        &nbsp;&nbsp;<br />
                        &nbsp;&nbsp;<span className="text-violet-400">return</span> NextResponse.json(&#123;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;mrr,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;activeSubscribers: metrics.length,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;churnRate: <span className="text-amber-300">0.0082</span>,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;status: <span className="text-emerald-300">&quot;success&quot;</span><br />
                        &nbsp;&nbsp;&#123;);<br />
                        &#125;
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. VISUAL CLICK-TO-EDIT TAB */}
                {activeTab === "visual-edit" && (
                  <div className="relative rounded-xl border-2 border-indigo-500/50 bg-[#121214] p-5 shadow-2xl text-white">
                    {/* Visual inspector banner */}
                    <div className="mb-4 px-3 py-2 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-indigo-200">
                        <MousePointer2 className="size-3.5 text-indigo-400 animate-bounce" />
                        <span><strong>Visual Click-to-Edit Mode:</strong> Hover or click any UI element to pinpoint component</span>
                      </div>
                      <span className="text-[10px] font-mono bg-indigo-500/30 px-2 py-0.5 rounded text-indigo-300">
                        Inspection Active
                      </span>
                    </div>

                    {/* Clickable UI elements with inspect hover */}
                    <div className="space-y-4">
                      <div
                        onMouseEnter={() => setHoveredElement("StatCard")}
                        onMouseLeave={() => setHoveredElement(null)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${
                          hoveredElement === "StatCard"
                            ? "border-sky-400 bg-sky-500/10 ring-2 ring-sky-400/20"
                            : "border-white/10 bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/60">Component: &lt;StatCard title=&quot;MRR&quot; /&gt;</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-sky-300">
                            src/components/stat-card.tsx:L12
                          </span>
                        </div>
                        <strong className="text-2xl font-mono mt-2 block font-bold">$48,290</strong>
                        <p className="text-xs text-emerald-400 mt-1">+14.2% Monthly Recurring Revenue</p>
                      </div>

                      {/* Visual Action Popover Simulation */}
                      <div className="p-3.5 rounded-lg bg-indigo-950/80 border border-indigo-500/40 shadow-xl">
                        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-200 mb-2">
                          <Sparkles className="size-3.5 text-indigo-400" />
                          <span>AI Visual Refactor Prompt:</span>
                        </div>
                        <p className="text-xs text-white/90 bg-black/40 p-2.5 rounded border border-white/10 font-mono">
                          &quot;Change the growth indicator from solid text to an animated pill badge with an upward arrow and green glow.&quot;
                        </p>
                        <div className="mt-2.5 flex justify-end">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                          >
                            <span>Apply Visual Edit</span>
                            <ArrowRight className="size-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. TIME-TRAVEL CHECKPOINTS & DIFF TAB */}
                {activeTab === "diff" && (
                  <div className="rounded-xl border border-white/10 bg-[#121214] overflow-hidden text-xs font-mono shadow-2xl">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e0e10] border-b border-white/8">
                      <div className="flex items-center gap-2">
                        <GitCommit className="size-3.5 text-indigo-400" />
                        <span className="font-semibold text-white">Checkpoint #04: Added Stripe Webhook Handler</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-emerald-400">+18 lines</span>
                        <span className="text-[10px] text-rose-400">-4 lines</span>
                        <button
                          type="button"
                          className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[10px]"
                        >
                          <RotateCcw className="size-2.5" />
                          <span>Rollback</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-4 space-y-1 bg-[#101012] font-mono leading-relaxed">
                      <div className="text-white/40 text-[11px] pb-1 border-b border-white/5">
                        --- a/src/app/api/webhooks/stripe/route.ts<br />
                        +++ b/src/app/api/webhooks/stripe/route.ts
                      </div>
                      <div className="text-white/50 pl-4">@@ -12,4 +12,18 @@</div>
                      <div className="bg-rose-500/10 text-rose-300 px-2 py-0.5 rounded-sm">
                        - const event = req.body;
                      </div>
                      <div className="bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded-sm">
                        + const signature = headers().get(&quot;stripe-signature&quot;);
                      </div>
                      <div className="bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded-sm">
                        + const event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_SECRET);
                      </div>
                      <div className="bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded-sm">
                        + await db.insert(invoices).values(&#123; amount: event.data.object.amount_paid &#125;);
                      </div>
                      <div className="text-white/50 pl-4">&nbsp;&nbsp;return NextResponse.json(&#123; received: true &#125;);</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
