import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/privacidade", "/termos"];
  return routes.map((route) => ({
    url: `${env.NEXT_PUBLIC_SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "yearly",
    priority: route === "" ? 1 : 0.3,
  }));
}
