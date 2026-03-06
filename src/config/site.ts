const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.dondeeshoy.com").replace(/\/$/, "");

export const siteConfig = {
  name: "¿Dónde es Hoy?",
  description: "Todo lo que pasa en Uruguay, en un solo lugar.",
  url: siteUrl,
  locale: "es-UY",
  city: "Uruguay",
  logoPath: "/brandmark.png",
  icon192Path: "/icon-192.png",
  icon512Path: "/icon-512.png",
} as const;
