import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/proximos", "/mapa", "/evento/"],
        disallow: ["/api/"],
      },
    ],
    sitemap: "https://dondeeshoy.com/sitemap.xml",
  };
}
