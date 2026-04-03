import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema/events";
import { and, eq, gte } from "drizzle-orm";
import { siteConfig } from "@/config/site";
import { getTodayUY } from "@/lib/format";

const BASE_URL = siteConfig.url;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const today = getTodayUY();
  const staticLastModified = new Date(`${today}T00:00:00-03:00`);

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: staticLastModified,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/proximos`,
      lastModified: staticLastModified,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/mapa`,
      lastModified: staticLastModified,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/comunidad`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/publicar`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/suscribirse`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  // Dynamic event routes
  try {
    const activeEvents = await db
      .select({
        slug: events.slug,
        updatedAt: events.updatedAt,
      })
      .from(events)
      .where(and(eq(events.status, "active"), gte(events.date, today)));

    const eventRoutes: MetadataRoute.Sitemap = activeEvents.map((event) => ({
      url: `${BASE_URL}/evento/${event.slug}`,
      lastModified: event.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

    return [...staticRoutes, ...eventRoutes];
  } catch {
    // If DB is unavailable, return only static routes
    return staticRoutes;
  }
}
