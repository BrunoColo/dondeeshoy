"use client";

import dynamic from "next/dynamic";
import type { MapEvent } from "./event-map";

const EventMapLazy = dynamic(
  () => import("./event-map").then((m) => m.EventMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="skeleton h-8 w-8 rounded-full" />
          <p className="text-text-muted text-sm">Cargando mapa...</p>
        </div>
      </div>
    ),
  },
);

interface EventMapWrapperProps {
  events: MapEvent[];
}

export function EventMapWrapper({ events }: EventMapWrapperProps) {
  return <EventMapLazy events={events} />;
}
