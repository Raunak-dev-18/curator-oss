import { ArrowRight, Sparkles } from "lucide-react";
import { isAuthConfigured } from "@/lib/auth0";

export function LandingCTA() {
  return (
    <section className="landing-cta-section">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="landing-cta-card">
          <div className="landing-cta-glow" aria-hidden="true" />

          <div className="relative z-10 text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium backdrop-blur-md mb-6">
              <Sparkles className="size-3.5 text-indigo-400" />
              <span>Instant Setup · No Credit Card Required</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-semibold tracking-[-0.04em] text-white leading-tight text-balance">
              Start building your next full-stack idea in seconds.
            </h2>

            <p className="mt-4 text-sm sm:text-base text-white/60 leading-relaxed text-balance">
              Describe your software in natural language. Cognix writes the code, provisions the database, and spins up a live preview.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {isAuthConfigured ? (
                <>
                  <a
                    href="/auth/login?screen_hint=signup"
                    className="landing-cta-primary-btn"
                  >
                    <span>Create free account</span>
                    <ArrowRight className="size-4" />
                  </a>
                  <a href="/auth/login" className="landing-cta-secondary-btn">
                    Sign in to existing project
                  </a>
                </>
              ) : (
                <a href="#hero-composer" className="landing-cta-primary-btn">
                  <span>Try interactive prompt</span>
                  <ArrowRight className="size-4" />
                </a>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-white/8 flex flex-wrap items-center justify-center gap-6 text-xs text-white/40 font-mono">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Daytona Sandboxes Online
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Neon Postgres Ready
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Zero Lock-In Code Export
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
