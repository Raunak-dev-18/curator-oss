import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { isAuthConfigured } from "@/lib/auth0";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export function LandingNav() {
  return (
    <header className="landing-nav-wrap">
      <nav className="landing-nav" aria-label="Main navigation">
        <div className="flex items-center gap-6">
          <Link href="/" className="inline-flex items-center gap-2.5 group" aria-label="Cognix home">
            <BrandMark className="size-6 transition-transform group-hover:scale-105" />
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-white">Cognix</span>
            <span className="landing-nav-version-badge">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              v2.0
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1 pl-4 border-l border-white/10">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#how-it-works" className="landing-nav-link">How it works</a>
            <a href="#showcase" className="landing-nav-link">Showcase</a>
            <a href="#comparison" className="landing-nav-link">Architecture</a>
            <a href="#faq" className="landing-nav-link">FAQ</a>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-github-link"
            aria-label="Cognix on GitHub"
          >
            <GithubIcon className="size-4" />
            <span className="hidden sm:inline">Star</span>
            <span className="landing-github-count font-mono">1.4k</span>
          </a>

          {isAuthConfigured ? (
            <>
              <a href="/auth/login" className="landing-nav-signin">
                Sign in
              </a>
              <a href="/auth/login?screen_hint=signup" className="landing-nav-cta">
                <Sparkles className="size-3.5 text-indigo-400" />
                <span>Start building</span>
                <ArrowRight className="size-3.5" />
              </a>
            </>
          ) : (
            <a href="#hero-composer" className="landing-nav-cta">
              <Sparkles className="size-3.5 text-indigo-400" />
              <span>Try Demo</span>
            </a>
          )}
        </div>
      </nav>
    </header>
  );
}
