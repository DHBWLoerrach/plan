import type { MetadataRoute } from "next";
/** Public search and detail pages stay indexable; every internal path — the sign-in page included — is excluded. */
export default function robots(): MetadataRoute.Robots { return { rules: [{ userAgent: "*", allow: "/", disallow: ["/intern/", "/api/"] }] }; }
