import { NextResponse } from "next/server";
import {
  acquireCronLock,
  getNoStoreHeaders,
  isCronAuthorized,
  releaseCronLock,
} from "@/lib/security";
import { getVerifiedSubscribers, getEventsForDateRange, filterEventsForSubscriber } from "@/lib/subscription-queries";
import { sendDigestEmail, type DigestEvent } from "@/lib/subscription-emails";
import { getWeekendDatesUY, getTodayUY, getTomorrowUY } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_WEEKLY_EVENTS_PER_SUBSCRIBER = 30;
const MAX_DAILY_EVENTS_PER_SUBSCRIBER = 12;
const MAX_EVENTS_PER_DAY = 10;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Boletín cron endpoint.
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

  const lock = await acquireCronLock("boletin", 300);

  if (!lock) {
    return NextResponse.json(
      { ok: false, error: "Boletín ya en ejecución." },
      { status: 409, headers: getNoStoreHeaders() },
    );
  }

  try {
    const url = new URL(request.url);
    const forceFrequency = url.searchParams.get("frequency") as "weekly" | "daily" | null;
    const previewEmailParam = url.searchParams.get("previewEmail");
    const previewEmail = previewEmailParam?.trim().toLowerCase() ?? "";
    const previewTypeParam = url.searchParams.get("previewType");
    const previewType = previewTypeParam?.trim().toLowerCase() ?? "";
    const dryRun = /^(1|true|yes)$/i.test(url.searchParams.get("dryRun") ?? "");
    const today = getTodayUY();

    if (previewEmail) {
      if (!EMAIL_REGEX.test(previewEmail)) {
        return NextResponse.json(
          { ok: false, error: "previewEmail inválido." },
          { status: 400, headers: getNoStoreHeaders() },
        );
      }

      const weekend = getNextWeekendDatesUY(today);
      const allWeekendEvents = await getEventsForDateRange(weekend.start, weekend.end);
      const matchingTypeEvents = previewType
        ? allWeekendEvents.filter((event) => event.eventType.toLowerCase() === previewType)
        : allWeekendEvents;

      const selectedEvents = limitDigestEvents(matchingTypeEvents, {
        maxTotal: MAX_WEEKLY_EVENTS_PER_SUBSCRIBER,
        maxPerDay: MAX_EVENTS_PER_DAY,
      });

      const eventsByDay = groupEventsByDate(selectedEvents);

      if (!dryRun && selectedEvents.length > 0) {
        await sendDigestEmail(
          previewEmail,
          "preview-only-token",
          null,
          eventsByDay,
          true,
        );
      }

      return NextResponse.json(
        {
          ok: true,
          preview: true,
          frequency: "weekly",
          email: previewEmail,
          eventType: previewType || "all",
          weekendMode: "next",
          dryRun,
          sent: !dryRun && selectedEvents.length > 0,
          weekend,
          totalFound: matchingTypeEvents.length,
          totalSelected: selectedEvents.length,
          byDate: Array.from(eventsByDay.entries()).map(([date, events]) => ({
            date,
            count: events.length,
          })),
        },
        { headers: getNoStoreHeaders() },
      );
    }

    const dayOfWeek = new Date(today + "T12:00:00").getDay(); // 0=Sun, 4=Thu

    const results = {
      weekly: { sent: 0, skipped: 0, errors: 0 },
      daily: { sent: 0, skipped: 0, errors: 0 },
    };

    // ── Weekly boletín (Thursday) ──
    const shouldSendWeekly = forceFrequency === "weekly" || (!forceFrequency && dayOfWeek === 4);

    if (shouldSendWeekly) {
      const weekend = getWeekendDatesUY();
      const events = await getEventsForDateRange(weekend.start, weekend.end);
      const subscribers = await getVerifiedSubscribers("weekly");

      for (const subscriber of subscribers) {
        try {
          const filtered = filterEventsForSubscriber(events, subscriber);

          const limited = limitDigestEvents(filtered, {
            maxTotal: MAX_WEEKLY_EVENTS_PER_SUBSCRIBER,
            maxPerDay: MAX_EVENTS_PER_DAY,
          });

          if (limited.length === 0) {
            results.weekly.skipped++;
            continue;
          }

          // Group events by date
          const eventsByDay = groupEventsByDate(limited);

          await sendDigestEmail(
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
          console.error(`[boletin] Error sending weekly to ${subscriber.email}:`, err);
          results.weekly.errors++;
        }
      }
    }

    // ── Daily boletín ──
    const shouldSendDaily = forceFrequency === "daily" || (!forceFrequency && true);

    if (shouldSendDaily) {
      const tomorrow = getTomorrowUY();
      const events = await getEventsForDateRange(tomorrow, tomorrow);
      const subscribers = await getVerifiedSubscribers("daily");

      for (const subscriber of subscribers) {
        try {
          const filtered = filterEventsForSubscriber(events, subscriber);

          const limited = limitDigestEvents(filtered, {
            maxTotal: MAX_DAILY_EVENTS_PER_SUBSCRIBER,
            maxPerDay: MAX_EVENTS_PER_DAY,
          });

          if (limited.length === 0) {
            results.daily.skipped++;
            continue;
          }

          const eventsByDay = groupEventsByDate(limited);

          await sendDigestEmail(
            subscriber.email,
            subscriber.unsubscribeToken,
            subscriber.name,
            eventsByDay,
            false,
          );

          results.daily.sent++;

          await sleep(200);
        } catch (err) {
          console.error(`[boletin] Error sending daily to ${subscriber.email}:`, err);
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

function toDigestEvent(e: QueryEvent): DigestEvent {
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
): Map<string, DigestEvent[]> {
  const grouped = new Map<string, DigestEvent[]>();

  for (const event of events) {
    const date = event.date;
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(toDigestEvent(event));
  }

  return grouped;
}

function limitDigestEvents(
  events: QueryEvent[],
  options: { maxTotal: number; maxPerDay: number },
): QueryEvent[] {
  if (events.length <= options.maxTotal) {
    return events;
  }

  const limited: QueryEvent[] = [];
  const perDayCounts = new Map<string, number>();

  for (const event of events) {
    if (limited.length >= options.maxTotal) {
      break;
    }

    const currentDayCount = perDayCounts.get(event.date) ?? 0;
    if (currentDayCount >= options.maxPerDay) {
      continue;
    }

    limited.push(event);
    perDayCounts.set(event.date, currentDayCount + 1);
  }

  return limited;
}

function getNextWeekendDatesUY(today: string): { start: string; end: string } {
  const [year, month, day] = today.split("-").map(Number);
  const todayDate = new Date(year, month - 1, day, 12, 0, 0);
  const dayOfWeek = todayDate.getDay(); // 0=Sun, 5=Fri

  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  const offsetToStart = daysUntilFriday === 0 ? 7 : daysUntilFriday;

  const start = new Date(todayDate);
  start.setDate(start.getDate() + offsetToStart);

  const end = new Date(start);
  end.setDate(end.getDate() + 2);

  return {
    start: formatDateForQuery(start),
    end: formatDateForQuery(end),
  };
}

function formatDateForQuery(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
