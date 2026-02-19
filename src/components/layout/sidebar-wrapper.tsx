"use client";

import { usePathname } from "next/navigation";

interface SidebarWrapperProps {
  children?: React.ReactNode;
}

/**
 * Client wrapper for the outermost layout container.
 */
export function LayoutGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1600px] lg:flex lg:items-start">
      {children}
    </div>
  );
}

/**
 * Client wrapper for <main> that removes horizontal padding on full-bleed
 * pages like /evento/* and /mapa, letting content touch the screen edges.
 */
export function MainWrapper({
  children,
  defaultClassName,
}: {
  children: React.ReactNode;
  defaultClassName: string;
}) {
  const pathname = usePathname();
  const isFullBleed = pathname === "/mapa" || pathname.startsWith("/evento/");
  return (
    <main
      id="main-content"
      className={isFullBleed ? "min-w-0 flex-1" : defaultClassName}
    >
      {children}
    </main>
  );
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
