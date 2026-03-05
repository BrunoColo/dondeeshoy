import "server-only";

import { db } from "@/lib/db";
import { emailSubscribers } from "@/lib/db/schema/subscribers";
import { events } from "@/lib/db/schema/events";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import type { EmailSubscriber, NewEmailSubscriber } from "@/lib/db/schema/subscribers";

/* ─── Create ─── */

export async function createSubscriber(
  data: Omit<NewEmailSubscriber, "id" | "createdAt" | "updatedAt">,
): Promise<EmailSubscriber> {
  const [subscriber] = await db
    .insert(emailSubscribers)
    .values(data)
    .returning();
  return subscriber;
}

/* ─── Verify ─── */

export async function verifySubscriber(token: string): Promise<EmailSubscriber | null> {
  const result = await db
    .update(emailSubscribers)
    .set({ verified: true, updatedAt: new Date() })
    .where(
      and(
        eq(emailSubscribers.verificationToken, token),
        eq(emailSubscribers.verified, false),
      ),
    )
    .returning();
  return result[0] ?? null;
}

/* ─── Unsubscribe ─── */

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const result = await db
    .delete(emailSubscribers)
    .where(eq(emailSubscribers.unsubscribeToken, token))
    .returning({ id: emailSubscribers.id });
  return result.length > 0;
}

/* ─── Find by email ─── */

export async function findSubscriberByEmail(
  email: string,
): Promise<EmailSubscriber | null> {
  const [subscriber] = await db
    .select()
    .from(emailSubscribers)
    .where(eq(emailSubscribers.email, email.toLowerCase()))
    .limit(1);
  return subscriber ?? null;
}

/* ─── Get verified subscribers by frequency ─── */

export async function getVerifiedSubscribers(
  frequency: "weekly" | "daily",
): Promise<EmailSubscriber[]> {
  return db
    .select()
    .from(emailSubscribers)
    .where(
      and(
        eq(emailSubscribers.verified, true),
        eq(emailSubscribers.frequency, frequency),
      ),
    );
}

/* ─── Get events for newsletter ─── */

export async function getEventsForDateRange(
  startDate: string,
  endDate: string,
): Promise<
  {
    id: string;
    name: string;
    slug: string;
    date: string;
    startTime: string | null;
    venueName: string;
    city: string;
    eventType: string;
    isFree: boolean;
    priceMin: number | null;
    priceMax: number | null;
    currency: string;
    imageUrl: string | null;
  }[]
> {
  return db
    .select({
      id: events.id,
      name: events.name,
      slug: events.slug,
      date: events.date,
      startTime: events.startTime,
      venueName: events.venueName,
      city: events.city,
      eventType: events.eventType,
      isFree: events.isFree,
      priceMin: events.priceMin,
      priceMax: events.priceMax,
      currency: events.currency,
      imageUrl: events.imageUrl,
    })
    .from(events)
    .where(
      and(
        eq(events.status, "active"),
        gte(events.date, startDate),
        lte(events.date, endDate),
      ),
    )
    .orderBy(asc(events.date), asc(events.startTime));
}

/* ─── Filter events by subscriber preferences ─── */

export function filterEventsForSubscriber(
  allEvents: Awaited<ReturnType<typeof getEventsForDateRange>>,
  subscriber: EmailSubscriber,
) {
  return allEvents.filter((event) => {
    // Filter by departments if specified
    if (subscriber.departments && subscriber.departments.length > 0) {
      const eventDept = event.city.toLowerCase();
      const matches = subscriber.departments.some(
        (d) => d.toLowerCase() === eventDept,
      );
      if (!matches) return false;
    }

    // Filter by event types if specified
    if (subscriber.eventTypes && subscriber.eventTypes.length > 0) {
      if (!subscriber.eventTypes.includes(event.eventType)) return false;
    }

    return true;
  });
}
