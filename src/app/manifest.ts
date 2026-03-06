import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: "DondeEsHoy",
    description: "Todos los eventos en Uruguay para hoy y próximos días.",
    start_url: "/",
    display: "standalone",
    background_color: "#06060C",
    theme_color: "#06060C",
    lang: "es-UY",
    icons: [
      {
        src: siteConfig.icon512Path,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: siteConfig.icon192Path,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: siteConfig.icon192Path,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: siteConfig.icon512Path,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: siteConfig.icon512Path,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
