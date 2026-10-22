import Image from "next/image";
import Link from "next/link";
import FadeInSection from "./FadeInSection";

export interface UnifiedEvent {
  _id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  time?: string;
  category: "Networking" | "Business" | "Community";
  image?: string;
  ctaText?: string;
  link?: string;
}

export default function UnifiedEventCard({
  title,
  description,
  location,
  date,
  time,
  category,
  image,
  ctaText = "Register Now",
  link = "#",
}: UnifiedEvent) {
  return (
    <FadeInSection>
      <article className="event-card">
        {image && (
          <div className="event-card-image-wrap">
            <Image src={image} alt={title} width={320} height={180} className="event-card-image" />
          </div>
        )}
        <div className="event-card-content">
          <span className={`event-card-category event-card-category-${category.toLowerCase()}`}>{category}</span>
          <h2 className="event-card-title">{title}</h2>
          <p className="event-card-description">{description}</p>
          <div className="event-card-meta">
            <span className="event-card-date">{date}</span>
            {time && <span className="event-card-time">{time}</span>}
            <span className="event-card-location">{location}</span>
          </div>
          <Link href={link} className="btn btn-primary event-card-cta">{ctaText}</Link>
        </div>
      </article>
    </FadeInSection>
  );
}
