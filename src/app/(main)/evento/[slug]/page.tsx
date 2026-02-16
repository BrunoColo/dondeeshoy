import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getEventBySlug } from "@/lib/queries";
import { EventDetail } from "@/components/events/event-detail";
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

  return {
    title: event.name,
    description: `${event.name} en ${event.venueName} — ${event.date}`,
    openGraph: {
      title: event.name,
      description: `${event.name} en ${event.venueName}`,
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

  return <EventDetail event={event} />;
}

function EventDetailLoading() {
  return (
    <div className="fade-up">
      {/* Hero skeleton */}
      <div className="skeleton h-64 sm:h-80 rounded-none" />

      {/* Content skeleton */}
      <div className="relative -mt-6 rounded-t-3xl bg-background px-5 pt-6 pb-32">
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
  );
}
