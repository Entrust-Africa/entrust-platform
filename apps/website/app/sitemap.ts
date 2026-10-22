import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://entrustafrica.com";
  const now = new Date();

  const routes = [
    "",
    "/contact",
    "/entrust",
    "/entrust/about",
    "/entrust/services",
    "/entrust/experience",
    "/entrust/contact",
    "/andinet",
    "/andinet/about",
    "/andinet/events",
    "/andinet/programs",
    "/andinet/contact",
    "/afri-bridge",
    "/afri-bridge/how-it-works",
    "/afri-bridge/contact",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}
