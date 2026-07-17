import type { MetadataRoute } from "next";

// Crawlers welcome everywhere — every page is public read-only data.
// (Phase 5 SEO item pulled forward 2026-07-17: Alan wants GritCheck
// findable by name before launch marketing starts.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://gritcheck.live/sitemap.xml",
  };
}
