import type { MetadataRoute } from "next";
import { SITE_URL } from "./lib/site";

const ROUTES = [
  "",
  "/trade",
  "/clear-export",
  "/mizan",
  "/entrust",
  "/about",
  "/events",
  "/partners",
  "/community",
  "/contact",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}
