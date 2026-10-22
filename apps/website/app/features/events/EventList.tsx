import EventCard from "./EventCard";

interface Event {
  _id: string;
  title: string;
  subtitle?: string;
  description: string;
  location: string;
  date?: string;
  ctaText?: string;
  images?: string[];
  highlights?: string[];
  badge?: string;
}

interface EventListProps {
  events: Event[];
  sectionTitle?: string;
}

export default function EventList({ events, sectionTitle }: EventListProps) {
  // Split events into upcoming and past (assume date is ISO string)
  const now = new Date();
  const upcoming = events.filter(e => e.date && new Date(e.date) >= now);
  const past = events.filter(e => !e.date || new Date(e.date) < now);
  return (
    <section className="event-list-section">
      {sectionTitle && <h2 className="event-list-title">{sectionTitle}</h2>}
      {upcoming.length > 0 && <h3 className="event-list-label">Upcoming Events</h3>}
      <div className="event-list-grid">
        {upcoming.map((event) => (
          <EventCard key={event._id} {...event} ctaText={event.ctaText || "Register"} />
        ))}
      </div>
      {past.length > 0 && <h3 className="event-list-label" style={{ marginTop: 40 }}>Past Events</h3>}
      <div className="event-list-grid">
        {past.map((event) => (
          <EventCard key={event._id} {...event} />
        ))}
      </div>
    </section>
  );
}
