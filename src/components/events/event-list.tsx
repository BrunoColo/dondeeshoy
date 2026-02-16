import { EventCard } from "./event-card";
import type { Event } from "@/lib/db/schema/events";

interface EventListProps {
  events: Event[];
  className?: string;
}

export function EventList({ events, className }: EventListProps) {
  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((event) => (
          <EventCard
            key={event.id}
            id={event.id}
            slug={event.slug}
            name={event.name}
            date={event.date}
            startTime={event.startTime}
            endTime={event.endTime}
            venueName={event.venueName}
            eventType={event.eventType}
            imageUrl={event.imageUrl}
            priceMin={event.priceMin}
            priceMax={event.priceMax}
            isFree={event.isFree}
            currency={event.currency}
            musicGenre={event.musicGenre}
          />
        ))}
      </div>
    </div>
  );
}
