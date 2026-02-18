"use client";

import { usePathname } from "next/navigation";

interface SidebarWrapperProps {
  children?: React.ReactNode;
}

/**
 * Client wrapper that hides the sidebar on routes where it doesn't make sense.
 * The actual sidebar content is passed as children (server component).
 */
export function SidebarWrapper({ children }: SidebarWrapperProps) {
  const pathname = usePathname();

  // Don't show sidebar on full-screen map or event detail pages
  if (pathname === "/mapa" || pathname.startsWith("/evento/")) {
    return null;
  }

  return <>{children}</>;
}
