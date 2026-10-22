import Image from "next/image";

import Link from "next/link";

interface EventCardProps {
  title: string;
  subtitle?: string;
  description: string;
  location: string;
  date?: string;
  ctaText?: string;
  images?: string[];
  highlights?: string[];
  badge?: string;
  category?: string;
  slug?: string;
}

export default function EventCard({
  title,
  subtitle,
  description,
  location,
  date,
  ctaText,
  images = [],
  highlights = [],
  badge,
  category,
  slug,
}: EventCardProps) {
  return (
    <article className="event-card">
      <div className="event-card-main">
        {/* Category badge always visible */}
        {category && <span className={`event-card-category event-card-category--${category.toLowerCase()}`}>{category}</span>}
        {badge && <span className="event-card-badge">{badge}</span>}
        <h2 className="event-card-title">{title}</h2>
        {subtitle && <p className="event-card-subtitle">{subtitle}</p>}
        <p className="event-card-description">{description}</p>
        <p className="event-card-location">{location}</p>
        {date && <p className="event-card-date">{date}</p>}
        {highlights.length > 0 && (
          <ul className="event-card-highlights">
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {ctaText && slug ? (
          <Link href={`/events/${slug}`} className="event-card-cta">{ctaText}</Link>
        ) : ctaText ? (
          <button className="event-card-cta">{ctaText}</button>
        ) : null}
      </div>
      {images.length > 0 && (
        <div className="event-card-gallery">
          {images.map((src) => (
            <figure key={src} className="event-card-image-figure">
              <Image src={src} alt={title} width={320} height={180} className="event-card-image" />
            </figure>
          ))}
        </div>
      )}
    </article>
  );
}
