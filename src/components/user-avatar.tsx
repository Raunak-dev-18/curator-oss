"use client";

import { useState } from "react";
import type { Viewer } from "@/lib/types";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  viewer: Pick<Viewer, "name" | "email" | "picture">;
  className?: string;
};

function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts.at(-1)?.[0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || email.slice(0, 2)).toUpperCase();
}

export function UserAvatar({ viewer, className }: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (viewer.picture && !imageFailed) {
    return (
      // Auth0 profile pictures may come from any configured identity provider.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={cn("user-avatar", className)}
        src={viewer.picture}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <span className={cn("user-avatar user-avatar-fallback", className)} aria-hidden="true">
      {initials(viewer.name, viewer.email)}
    </span>
  );
}
