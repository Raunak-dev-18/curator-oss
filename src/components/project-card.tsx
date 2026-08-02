import { ArrowUpRight, Clock3 } from "lucide-react";
import Link from "next/link";
import type { Project, Viewer } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";

export function ProjectCard({ project, viewer }: { project: Project; viewer: Viewer }) {
  return (
    <article className="project-card group">
      <Link href={`/projects/${project.id}`} className={`project-thumbnail project-gradient-${project.coverGradient}`}>
        <div className="project-cover-copy">
          <span className="project-cover-initial">{project.title.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{project.title}</strong>
            <p>{project.description || "Created with Cognix"}</p>
          </div>
        </div>
        <span className="project-status">
          <span className={project.status === "error" ? "bg-red-500" : project.status === "building" ? "bg-amber-500" : project.status === "draft" ? "bg-black/35" : "bg-emerald-500"} />
          {project.publishedAt ? "Published" : project.status === "ready" ? "Preview ready" : project.status === "building" ? "Building" : project.status === "error" ? "Needs attention" : "Draft"}
        </span>
      </Link>
      <div className="flex items-start gap-3 px-1 pt-3">
        <UserAvatar viewer={viewer} className="size-8" />
        <div className="min-w-0 flex-1">
          <Link href={`/projects/${project.id}`} className="inline-flex max-w-full items-center gap-1 text-[13px] font-semibold text-white hover:underline">
            <span className="truncate">{project.title}</span>
            <ArrowUpRight className="size-3 opacity-0 transition group-hover:opacity-60" />
          </Link>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-white/38">
            <span className="truncate">{viewer.name}</span><span aria-hidden="true">·</span><Clock3 className="size-3 shrink-0" /><span className="shrink-0">{formatRelativeDate(project.updatedAt)}</span>
          </p>
        </div>
      </div>
    </article>
  );
}
