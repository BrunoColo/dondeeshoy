import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/ingreso-admin", "/internal-admin-access", "/favoritos"],
      },
    ],
    host: new URL(siteConfig.url).host,
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
