"use client";

import { usePathname } from "next/navigation";

interface SidebarWrapperProps {
  children?: React.ReactNode;
}

/**
 * Client wrapper that hides the RIGHT sidebar on routes where it doesn't make sense.
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

/**
 * Client wrapper that hides the LEFT filter panel on routes where it doesn't make sense.
 * Mirrors SidebarWrapper — hidden on /mapa and /evento/*.
 */
export function LeftPanelWrapper({ children }: SidebarWrapperProps) {
  const pathname = usePathname();

  if (pathname === "/mapa" || pathname.startsWith("/evento/")) {
    return null;
  }

  return <>{children}</>;
}
