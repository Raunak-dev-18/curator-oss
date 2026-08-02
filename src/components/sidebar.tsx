import { FolderKanban, Gauge, Plus } from "lucide-react";
import Link from "next/link";
import type { Project, Viewer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./account-menu";
import { BrandMark } from "./brand-mark";
import { UserAvatar } from "./user-avatar";

type SidebarProps = {
  viewer: Viewer;
  projects: Project[];
  active?: "dashboard" | "search" | "projects";
};

const navItems = [
  { label: "Dashboard", icon: Gauge, href: "/", key: "dashboard" },
  { label: "New project", icon: Plus, href: "/?focus=search#create-project", key: "search" },
  { label: "Projects", icon: FolderKanban, href: "/#projects", key: "projects" },
] as const;

export function Sidebar({ viewer, projects, active = "dashboard" }: SidebarProps) {
  return (
    <aside className="dashboard-sidebar" aria-label="Primary navigation">
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="inline-flex items-center gap-2 rounded-md" aria-label="Cognix home">
          <BrandMark className="size-5" />
          <span className="text-[13px] font-semibold tracking-[-0.01em]">Cognix</span>
        </Link>
      </div>

      <div className="px-2">
        <div className="workspace-identity">
          <UserAvatar viewer={viewer} className="size-7" />
          <span className="min-w-0">
            <strong>{viewer.name}</strong>
            <small>Personal workspace</small>
          </span>
        </div>
      </div>

      <nav className="mt-2 px-2">
        {navItems.map((item) => (
          <Link key={item.label} href={item.href} className={cn("sidebar-nav-item", active === item.key && "is-active")}>
            <item.icon className="size-4" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-6 min-h-0 flex-1 overflow-hidden px-4">
        <p className="sidebar-heading">Recents</p>
        <div className="mt-2 space-y-0.5">
          {projects.slice(0, 6).map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="block truncate rounded-md py-1.5 text-[12px] font-medium text-white/60 transition hover:text-white">
              {project.title}
            </Link>
          ))}
          {projects.length === 0 ? <p className="py-2 text-[11px] leading-5 text-white/28">Projects you create will appear here.</p> : null}
        </div>
      </div>

      <div className="border-t border-white/8 p-2">
        <AccountMenu viewer={viewer} />
      </div>
    </aside>
  );
}
