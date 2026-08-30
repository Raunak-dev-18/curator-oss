import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export function LandingFooter() {
  return (
    <footer className="landing-footer-section">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 pb-12 border-b border-white/8">
          {/* Brand & summary */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Cognix home">
              <BrandMark className="size-6" />
              <span className="text-base font-semibold tracking-[-0.02em] text-white">Cognix</span>
            </Link>
            <p className="text-xs text-white/50 leading-relaxed max-w-sm">
              The autonomous AI full-stack application builder. From prompt to running software inside isolated Daytona Linux sandboxes, backed by serverless Neon PostgreSQL.
            </p>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              All systems operational
            </div>
          </div>

          {/* Product links */}
          <div className="space-y-3 text-xs">
            <span className="font-semibold text-white tracking-wider uppercase text-[10px] text-white/40 block">
              Product
            </span>
            <ul className="space-y-2 text-white/60">
              <li><a href="#features" className="hover:text-white transition">Capabilities</a></li>
              <li><a href="#demo" className="hover:text-white transition">Workspace Simulator</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition">Autonomous Pipeline</a></li>
              <li><a href="#showcase" className="hover:text-white transition">App Showcase</a></li>
              <li><a href="#comparison" className="hover:text-white transition">Architecture Comparison</a></li>
            </ul>
          </div>

          {/* Infrastructure */}
          <div className="space-y-3 text-xs">
            <span className="font-semibold text-white tracking-wider uppercase text-[10px] text-white/40 block">
              Infrastructure
            </span>
            <ul className="space-y-2 text-white/60">
              <li><a href="https://daytona.io" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Daytona Sandboxes</a></li>
              <li><a href="https://neon.tech" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Neon PostgreSQL</a></li>
              <li><a href="https://nextjs.org" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Next.js 16 App Router</a></li>
              <li><a href="https://auth0.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Auth0 Zero Trust</a></li>
              <li><a href="https://orm.drizzle.team" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Drizzle ORM</a></li>
            </ul>
          </div>

          {/* Developers & Legal */}
          <div className="space-y-3 text-xs">
            <span className="font-semibold text-white tracking-wider uppercase text-[10px] text-white/40 block">
              Developers
            </span>
            <ul className="space-y-2 text-white/60">
              <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">GitHub Repository</a></li>
              <li><a href="#faq" className="hover:text-white transition">Documentation FAQ</a></li>
              <li><Link href="/auth/login" className="hover:text-white transition">Sign in</Link></li>
              <li><Link href="/auth/login?screen_hint=signup" className="hover:text-white transition">Create Account</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <p>© {new Date().getFullYear()} Cognix AI App Builder. Open source under Apache 2.0.</p>
          <p className="font-mono text-[11px] text-white/30">
            Built with Next.js App Router · Daytona · Neon
          </p>
        </div>
      </div>
    </footer>
  );
}
