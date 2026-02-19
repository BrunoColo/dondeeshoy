import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getEventBySlug } from "@/lib/queries";
import { EventDetail } from "@/components/events/event-detail";
import { ViewTracker } from "@/components/events/view-tracker";
import { siteConfig } from "@/config/site";
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

  return {
    title: event.name,
    description: `${event.name} en ${event.venueName} — ${event.date}`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: event.name,
      description: `${event.name} en ${event.venueName}`,
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

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    startDate,
    eventStatus,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venueName,
      ...(event.venueAddress && { address: event.venueAddress }),
    },
    ...(event.imageUrl && { image: [event.imageUrl] }),
    ...(event.ticketUrl && {
      offers: {
        "@type": "Offer",
        url: event.ticketUrl,
        priceCurrency: event.currency ?? "UYU",
        ...(event.priceMin != null && { price: event.priceMin }),
        availability: "https://schema.org/InStock",
      },
    }),
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
