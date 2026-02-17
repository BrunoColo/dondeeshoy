import { Suspense } from "react";
import { getEventsWithCoordinates } from "@/lib/queries";
import { getTodayUY } from "@/lib/format";
import type { Metadata } from "next";
import type { MapEvent } from "@/components/events/event-map";
import { EventMapWrapper } from "@/components/events/event-map-wrapper";

export const metadata: Metadata = {
  title: "Mapa — ¿Dónde es hoy?",
  description: "Encontrá eventos cerca tuyo en el mapa",
};

export const revalidate = 3600;

export default function MapaPage() {
  return (
    <Suspense fallback={<MapLoading />}>
      <MapContent />
    </Suspense>
  );
}

async function MapContent() {
  const today = getTodayUY();
  const rawEvents = await getEventsWithCoordinates(today);

  const events: MapEvent[] = rawEvents
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
    }));

  if (events.length === 0) {
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
    <div className="h-[calc(100dvh-8rem)]">
      <EventMapWrapper events={events} />
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
