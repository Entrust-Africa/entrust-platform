import { client } from "./sanity";

const eventProjection = `{
  _id,
  title,
  slug,
  startDate,
  endDate,
  location,
  "image": image.asset->url,
  link,
  ctaText,
  description,
  category
}`;

/** Upcoming events only (Sanity CMS). */
export async function getEvents() {
  return await client.fetch(`
    *[_type == "event" && startDate > now()] | order(startDate asc)
    ${eventProjection}
  `);
}

/** All events for past/upcoming split on the events page. */
export async function getAllEvents() {
  return await client.fetch(`
    *[_type == "event"] | order(startDate desc)
    ${eventProjection}
  `);
}
