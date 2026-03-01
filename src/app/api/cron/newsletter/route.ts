import { NextResponse } from "next/server";
import {
  acquireCronLock,
  getNoStoreHeaders,
  isCronAuthorized,
  releaseCronLock,
} from "@/lib/security";
import { getVerifiedSubscribers, getEventsForDateRange, filterEventsForSubscriber } from "@/lib/subscription-queries";
import { sendNewsletterDigest, type NewsletterEvent } from "@/lib/subscription-emails";
import { getWeekendDatesUY, getTodayUY, getTomorrowUY } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Newsletter cron endpoint.
 * - Weekly: runs on Thursday, sends events for upcoming Fri-Sat-Sun
 * - Daily: runs every day, sends events for tomorrow
 *
 * Can be triggered manually with ?frequency=weekly|daily
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: getNoStoreHeaders() },
    );
  }

  const lock = await acquireCronLock("newsletter", 300);

  if (!lock) {
    return NextResponse.json(
      { ok: false, error: "Newsletter ya en ejecución." },
      { status: 409, headers: getNoStoreHeaders() },
    );
  }

  try {
    const url = new URL(request.url);
    const forceFrequency = url.searchParams.get("frequency") as "weekly" | "daily" | null;

    const today = getTodayUY();
    const dayOfWeek = new Date(today + "T12:00:00").getDay(); // 0=Sun, 4=Thu

    const results = {
      weekly: { sent: 0, skipped: 0, errors: 0 },
      daily: { sent: 0, skipped: 0, errors: 0 },
    };

    // ── Weekly newsletter (Thursday) ──
    const shouldSendWeekly = forceFrequency === "weekly" || (!forceFrequency && dayOfWeek === 4);

    if (shouldSendWeekly) {
      const weekend = getWeekendDatesUY();
      const events = await getEventsForDateRange(weekend.start, weekend.end);
      const subscribers = await getVerifiedSubscribers("weekly");

      for (const subscriber of subscribers) {
        try {
          const filtered = filterEventsForSubscriber(events, subscriber);

          if (filtered.length === 0) {
            results.weekly.skipped++;
            continue;
          }

          // Group events by date
          const eventsByDay = groupEventsByDate(filtered);

          await sendNewsletterDigest(
            subscriber.email,
            subscriber.unsubscribeToken,
            subscriber.name,
            eventsByDay,
            true,
          );

          results.weekly.sent++;

          // Small delay to avoid rate limiting from Resend
          await sleep(200);
        } catch (err) {
          console.error(`[newsletter] Error sending weekly to ${subscriber.email}:`, err);
          results.weekly.errors++;
        }
      }
    }

    // ── Daily newsletter ──
    const shouldSendDaily = forceFrequency === "daily" || (!forceFrequency && true);

    if (shouldSendDaily) {
      const tomorrow = getTomorrowUY();
      const events = await getEventsForDateRange(tomorrow, tomorrow);
      const subscribers = await getVerifiedSubscribers("daily");

      for (const subscriber of subscribers) {
        try {
          const filtered = filterEventsForSubscriber(events, subscriber);

          if (filtered.length === 0) {
            results.daily.skipped++;
            continue;
          }

          const eventsByDay = groupEventsByDate(filtered);

          await sendNewsletterDigest(
            subscriber.email,
            subscriber.unsubscribeToken,
            subscriber.name,
            eventsByDay,
            false,
          );

          results.daily.sent++;

          await sleep(200);
        } catch (err) {
          console.error(`[newsletter] Error sending daily to ${subscriber.email}:`, err);
          results.daily.errors++;
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        today,
        results,
      },
      { headers: getNoStoreHeaders() },
    );
  } finally {
    await releaseCronLock(lock);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type QueryEvent = Awaited<ReturnType<typeof getEventsForDateRange>>[number];

function toNewsletterEvent(e: QueryEvent): NewsletterEvent {
  return {
    name: e.name,
    slug: e.slug,
    date: e.date,
    startTime: e.startTime,
    venueName: e.venueName,
    city: e.city,
    eventType: e.eventType,
    isFree: e.isFree,
    priceMin: e.priceMin,
    priceMax: e.priceMax,
    currency: e.currency,
  };
}

function groupEventsByDate(
  events: QueryEvent[],
): Map<string, NewsletterEvent[]> {
  const grouped = new Map<string, NewsletterEvent[]>();

  for (const event of events) {
    const date = event.date;
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(toNewsletterEvent(event));
  }

  return grouped;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
