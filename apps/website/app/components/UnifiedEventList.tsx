import UnifiedEventCard, { UnifiedEvent } from "./UnifiedEventCard";

interface UnifiedEventListProps {
  events: UnifiedEvent[];
  sectionTitle?: string;
  category?: string;
}

export default function UnifiedEventList({ events, sectionTitle, category }: UnifiedEventListProps) {
  const filtered = category ? events.filter(e => e.category === category) : events;
  return (
    <section className="event-list-section">
      {sectionTitle && <h2 className="event-list-title">{sectionTitle}</h2>}
      <div className="event-list-grid">
        {filtered.map((event) => (
          <UnifiedEventCard key={event._id} {...event} />
        ))}
      </div>
    </section>
  );
}
