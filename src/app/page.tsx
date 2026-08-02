import { ArrowRight, Box, Database, Plus, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { DashboardComposer } from "@/components/dashboard-composer";
import { ProjectCard } from "@/components/project-card";
import { Sidebar } from "@/components/sidebar";
import { getViewer, isAuthConfigured } from "@/lib/auth0";
import { isDatabaseConfigured } from "@/lib/db";
import { ensureUser, listProjects } from "@/lib/store";

function SignedOutHome() {
  return (
    <main className="auth-home">
      <nav className="auth-nav" aria-label="Public navigation">
        <Link href="/" className="inline-flex items-center gap-2" aria-label="Cognix home">
          <BrandMark className="size-6" />
          <span className="text-[14px] font-semibold">Cognix</span>
        </Link>
        {isAuthConfigured ? (
          <div className="flex items-center gap-2">
            <a href="/auth/login" className="secondary-auth-button">Sign in</a>
            <a href="/auth/login?screen_hint=signup" className="primary-auth-button">Create account</a>
          </div>
        ) : null}
      </nav>

      <section className="auth-hero">
        <div className="auth-eyebrow"><Sparkles className="size-3.5" /> AI full-stack builder</div>
        <h1>Build working software from a conversation.</h1>
        <p>Describe your product. Cognix writes the code, runs it in an isolated workspace, and gives you a live preview to refine.</p>
        {isAuthConfigured ? (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="/auth/login?screen_hint=signup" className="auth-cta">
              Start building <ArrowRight className="size-4" />
            </a>
            <a href="/auth/login" className="auth-signin">I already have an account</a>
          </div>
        ) : (
          <div className="auth-config-notice">
            Authentication is not configured. Add the Auth0 variables to <code>.env.local</code> and restart the app.
          </div>
        )}
      </section>

      <section className="auth-capabilities" aria-label="Product capabilities">
        <article><Box className="size-4" /><strong>Isolated builds</strong><span>Every project runs in its own Daytona sandbox.</span></article>
        <article><Database className="size-4" /><strong>Real application data</strong><span>Projects and conversations persist in Neon PostgreSQL.</span></article>
        <article><ShieldCheck className="size-4" /><strong>Private by default</strong><span>Auth0 protects accounts and uploads stay in private storage.</span></article>
      </section>
    </main>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return <SignedOutHome />;

  await ensureUser(viewer);
  const projects = await listProjects(viewer.id);
  const { focus } = await searchParams;

  return (
    <div className="dashboard-shell">
      <Sidebar viewer={viewer} projects={projects} active={focus === "search" ? "search" : "dashboard"} />
      <main className="dashboard-content">
        <section className="dashboard-hero">
          <div className="hero-noise" />
          {!isDatabaseConfigured ? (
            <div className="database-notice" role="status">
              <Database className="size-3.5" />
              <span><strong>Neon is not connected.</strong> Projects are temporary until <code>DATABASE_URL</code> is configured.</span>
            </div>
          ) : null}
          <div className="relative z-10 flex w-full flex-col items-center px-5 pb-28 pt-24 text-center sm:pt-32 lg:pb-36 lg:pt-40">
            <div className="hero-badge"><Sparkles className="size-3.5 text-[#c9c3ff]" /> New project</div>
            <h1 className="mt-5 text-balance text-[34px] font-semibold leading-none tracking-[-0.045em] text-white sm:text-[42px]">
              What do you want to build?
            </h1>
            <p className="mt-3 max-w-md text-[14px] leading-6 text-white/55">
              Turn an idea into a working full-stack app, complete with code, data, uploads, and a live preview.
            </p>
            <div id="create-project" className="mt-7 flex w-full scroll-mt-8 justify-center">
              <DashboardComposer autoFocus={focus === "search"} />
            </div>
          </div>

          <section id="projects" className="project-shelf">
            <div className="flex flex-col gap-4 border-b border-white/8 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[14px] font-semibold text-white">Your projects</h2>
                <p className="mt-1 text-[11px] text-white/38">
                  {projects.length === 0 ? "No projects yet" : `${projects.length} ${projects.length === 1 ? "project" : "projects"}`}
                </p>
              </div>
              <Link href="/?focus=search#create-project" className="new-project-button"><Plus className="size-3.5" /> New project</Link>
            </div>
            {projects.length ? (
              <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
                {projects.map((project) => <ProjectCard key={project.id} project={project} viewer={viewer} />)}
              </div>
            ) : (
              <div className="grid min-h-60 place-items-center text-center">
                <div className="max-w-xs">
                  <span className="mx-auto grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-white/65"><Plus className="size-4" /></span>
                  <p className="mt-4 text-sm font-medium">Create your first project</p>
                  <p className="mt-1 text-xs leading-5 text-white/40">Describe the app above. Cognix will open a real workspace and begin building it.</p>
                  <Link href="/?focus=search#create-project" className="mt-4 inline-flex text-[12px] font-medium text-[#b8b0ff] hover:text-white">Go to the prompt <ArrowRight className="ml-1 size-3.5" /></Link>
                </div>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
