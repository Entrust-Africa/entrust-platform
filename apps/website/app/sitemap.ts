import type { MetadataRoute } from "next";

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
  const baseUrl = "https://entrustafrica.com";
  const now = new Date();

  return ROUTES.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}
