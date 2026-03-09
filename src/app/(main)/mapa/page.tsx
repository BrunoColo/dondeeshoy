import { Suspense } from "react";
import { getEventsWithCoordinates, getEventsBetweenDates } from "@/lib/queries";
import { getTodayUY, getTomorrowUY, getWeekendDatesUY } from "@/lib/format";
import type { Metadata } from "next";
import type { MapEvent } from "@/components/events/event-map";
import { EventMapWrapper } from "@/components/events/event-map-wrapper";

export const metadata: Metadata = {
  title: "Mapa — ¿Dónde es hoy?",
  description: "Encontrá eventos cerca tuyo en el mapa",
  alternates: {
    canonical: "/mapa",
  },
};

export const revalidate = 3600;

export default function MapaPage() {
  return (
    <Suspense fallback={<MapLoading />}>
      <MapContent />
    </Suspense>
  );
}

function toMapEvents(rawEvents: Awaited<ReturnType<typeof getEventsWithCoordinates>>): MapEvent[] {
  return rawEvents
    .filter((e) => e.latitude && e.longitude)
    .map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      date: e.date,
      startTime: e.startTime,
      venueName: e.venueName,
      eventType: e.eventType,
      latitude: parseFloat(e.latitude!),
      longitude: parseFloat(e.longitude!),
      priceMin: e.priceMin,
      isFree: e.isFree,
      currency: e.currency ?? undefined,
      imageUrl: e.imageUrl,
      isRecurring: e.isRecurring ?? false,
    }));
}

async function MapContent() {
  const today = getTodayUY();
  const tomorrow = getTomorrowUY();
  const weekend = getWeekendDatesUY();

  const [todayRaw, tomorrowRaw, weekendRaw] = await Promise.all([
    getEventsWithCoordinates(today),
    getEventsWithCoordinates(tomorrow),
    getEventsBetweenDates(weekend.start, weekend.end),
  ]);

  const todayEvents = toMapEvents(todayRaw);
  const tomorrowEvents = toMapEvents(tomorrowRaw);
  const weekendEvents = weekendRaw
    .filter((e) => e.latitude && e.longitude)
    .map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      date: e.date,
      startTime: e.startTime,
      venueName: e.venueName,
      eventType: e.eventType,
      latitude: parseFloat(e.latitude!),
      longitude: parseFloat(e.longitude!),
      priceMin: e.priceMin,
      isFree: e.isFree,
      currency: e.currency ?? undefined,
      imageUrl: e.imageUrl,
      isRecurring: e.isRecurring ?? false,
    })) as MapEvent[];

  const hasAnyEvents = todayEvents.length > 0 || tomorrowEvents.length > 0 || weekendEvents.length > 0;

  if (!hasAnyEvents) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] items-center justify-center px-4">
        <div className="glass-card rounded-2xl p-8 text-center max-w-sm">
          <p className="text-4xl mb-3">📍</p>
          <p className="text-text-secondary text-sm font-medium">
            No hay eventos con ubicación para hoy
          </p>
          <p className="text-text-muted text-xs mt-1">
            Los eventos aparecerán aquí cuando tengan coordenadas asignadas
          </p>
        </div>
      </div>
    );
  }

  return (
    /*
     * Full-bleed map container: escape the layout's px-4 sm:px-6 padding
     * and the DesktopSidebar column so the map+sidebar fills the full viewport width.
     * -mx-4 sm:-mx-6 cancels the parent padding.
     * lg:-mr-0 lg:-ml-0 is handled by the lg:flex layout below.
     * Height = 100dvh minus the 60px header.
     */
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-10 h-[calc(100dvh-60px)]">
      <EventMapWrapper
        todayEvents={todayEvents}
        tomorrowEvents={tomorrowEvents}
        weekendEvents={weekendEvents}
      />
    </div>
  );
}

function MapLoading() {
  return (
    <div className="flex h-[calc(100dvh-8rem)] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="skeleton h-8 w-8 rounded-full" />
        <p className="text-text-muted text-sm">Cargando mapa...</p>
      </div>
    </div>
  );
}
