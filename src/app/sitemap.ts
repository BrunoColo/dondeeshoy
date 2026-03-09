import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema/events";
import { eq } from "drizzle-orm";
import { siteConfig } from "@/config/site";

const BASE_URL = siteConfig.url;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/proximos`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/mapa`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/publicar`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/suscribirse`,
      lastModified: new Date(),
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
        date: events.date,
      })
      .from(events)
      .where(eq(events.status, "active"));

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
