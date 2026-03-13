import { Music, CalendarDays, MapPin, Users } from "lucide-react";

export const NAV_ITEMS = [
  { label: "Hoy", href: "/", icon: Music },
  { label: "Mapa", href: "/mapa", icon: MapPin },
  { label: "Próximos", href: "/proximos", icon: CalendarDays },
  { label: "Comunidad", href: "/comunidad", icon: Users },
] as const;

/** href used in the desktop header nav (anchors to top of home) */
export const HEADER_NAV_ITEMS = [
  { label: "Hoy", href: "/#top", icon: Music },
  { label: "Próximos", href: "/proximos", icon: CalendarDays },
  { label: "Mapa", href: "/mapa", icon: MapPin },
  { label: "Comunidad", href: "/comunidad", icon: Users },
] as const;
