import { Suspense } from "react";
import { getEventsWithCoordinates } from "@/lib/queries";
import { getTodayUY } from "@/lib/format";
import type { Metadata } from "next";
import { EventMap, type MapEvent } from "@/components/events/event-map";

export const metadata: Metadata = {
  title: "Mapa — ¿Dónde es hoy?",
  description: "Encontrá eventos cerca tuyo en el mapa",
};

export const revalidate = 3600;
export const dynamic = "force-dynamic";

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

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] items-center justify-center px-4">
        <div className="glass-card rounded-2xl p-8 text-center max-w-sm">
          <p className="text-text-secondary text-sm">
            El mapa no está disponible en este momento.
          </p>
          <p className="text-text-muted text-xs mt-2">
            Falta configurar NEXT_PUBLIC_MAPBOX_TOKEN
          </p>
        </div>
      </div>
    );
  }

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
      <EventMap events={events} token={token} />
    </div>
  );
}

function MapLoading() {
  return (
    <div className="h-[calc(100dvh-8rem)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-neon-violet/30 border-t-neon-violet animate-spin" />
        <p className="text-text-muted text-xs">Cargando mapa…</p>
      </div>
    </div>
  );
}
