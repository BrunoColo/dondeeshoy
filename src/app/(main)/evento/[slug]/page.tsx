import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getEventBySlug } from "@/lib/queries";
import { EventDetail } from "@/components/events/event-detail";
import { ViewTracker } from "@/components/events/view-tracker";
import { siteConfig } from "@/config/site";
import { EVENT_TYPE_LABELS } from "@/types/events";
import type { Metadata } from "next";

interface EventPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) {
    return { title: "Evento no encontrado" };
  }

  const canonicalUrl = `${siteConfig.url}/evento/${slug}`;

  const description = event.description
    ?? `${event.name} en ${event.venueName}, ${event.department ?? event.city}. ${event.date}.`;

  return {
    title: event.name,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: event.name,
      description,
      url: canonicalUrl,
      ...(event.imageUrl && {
        images: [{ url: event.imageUrl, width: 1200, height: 630 }],
      }),
    },
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;

  return (
    <Suspense fallback={<EventDetailLoading />}>
      <EventDetailContent slug={slug} />
    </Suspense>
  );
}

async function EventDetailContent({ slug }: { slug: string }) {
  const event = await getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const eventStatus =
    event.status === "cancelled"
      ? "https://schema.org/EventCancelled"
      : event.status === "past"
        ? "https://schema.org/EventCompleted"
        : "https://schema.org/EventScheduled";

  const startDate = event.startTime
    ? `${event.date}T${event.startTime}`
    : `${event.date}T20:00:00`;

  const endDate = event.endTime
    ? `${event.date}T${event.endTime}`
    : undefined;

  const eventDescription = event.description
    ?? `${event.name} en ${event.venueName}, ${event.department ?? event.city}.`;

  const locationAddress = event.venueAddress
    ?? `${event.venueName}, ${event.department ?? event.city}, Uruguay`;

  const offers = event.isFree
    ? {
        "@type": "Offer" as const,
        url: event.ticketUrl ?? `${siteConfig.url}/evento/${event.slug}`,
        priceCurrency: "UYU",
        price: 0,
        availability: "https://schema.org/InStock",
        validFrom: event.createdAt.toISOString(),
      }
    : event.ticketUrl
      ? {
          "@type": "Offer" as const,
          url: event.ticketUrl,
          priceCurrency: event.currency ?? "UYU",
          ...(event.priceMin != null && { price: event.priceMin }),
          availability: "https://schema.org/InStock",
          validFrom: event.createdAt.toISOString(),
        }
      : undefined;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    description: eventDescription,
    startDate,
    ...(endDate && { endDate }),
    eventStatus,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venueName,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.venueAddress ?? event.venueName,
        addressLocality: event.department ?? event.city,
        addressCountry: "UY",
      },
    },
    ...(event.imageUrl && { image: [event.imageUrl] }),
    ...(offers && { offers }),
    organizer: {
      "@type": "Organization",
      name: event.venueName,
      url: event.ticketUrl ?? `${siteConfig.url}/evento/${event.slug}`,
    },
    performer: {
      "@type": "PerformingGroup",
      name: event.name,
    },
    eventType: EVENT_TYPE_LABELS[event.eventType] ?? event.eventType,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <ViewTracker eventId={event.id} />
      <EventDetail event={event} />
    </>
  );
}

function EventDetailLoading() {
  return (
    <div className="fade-up">
      <div className="lg:overflow-hidden lg:rounded-2xl lg:border lg:border-white/[0.06]">
        {/* Hero skeleton */}
        <div className="skeleton h-48 sm:h-64 md:h-80 lg:h-96" />

        {/* Content skeleton */}
        <div className="relative -mt-6 rounded-t-3xl lg:rounded-t-none bg-background px-5 pt-6 pb-8">
          <div className="skeleton mb-4 h-6 w-20 rounded-full" />
          <div className="skeleton mb-2 h-7 w-4/5 rounded" />
          <div className="skeleton mb-6 h-7 w-3/5 rounded" />

          <div className="space-y-4">
            <div className="skeleton h-[72px] w-full rounded-xl" />
            <div className="skeleton h-[72px] w-full rounded-xl" />
            <div className="skeleton h-[72px] w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
