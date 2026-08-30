import { Router, Request, Response } from "express";
import { config } from "../../core/config.js";
import { getDatabase } from "../../db/mongo.js";

export const seoRouter = Router();

/**
 * GET /ads.txt
 * Google AdSense authorized digital sellers verification file
 */
export async function handleAdsTxt(_req: Request, res: Response): Promise<void> {
  const pubId = config.ADSENSE_PUB_ID || "pub-0000000000000000";
  const content = `# Google AdSense verification for ${config.SITE_DOMAIN}
google.com, ${pubId}, DIRECT, f08c47fec0942fa0
`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(content);
}

/**
 * GET /robots.txt
 * Search engine crawler instructions and sitemap directive
 */
export async function handleRobotsTxt(_req: Request, res: Response): Promise<void> {
  const content = `# Robots.txt for ${config.SITE_DOMAIN}
User-agent: *
Allow: /
Allow: /search
Allow: /locality/
Allow: /property/
Allow: /compare
Allow: /transit/
Disallow: /api/
Allow: /api/v1/seo/

# Sitemap location
Sitemap: ${config.SITE_URL}/sitemap.xml
`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(content);
}

/**
 * GET /sitemap.xml
 * Dynamic XML Sitemap indexing core routes, all 13 localities, and properties
 */
export async function handleSitemapXml(_req: Request, res: Response): Promise<void> {
  try {
    const db = getDatabase();
    const siteUrl = config.SITE_URL.replace(/\/$/, "");
    const nowIso = new Date().toISOString().split("T")[0];

    // Core static routes
    const staticRoutes = [
      { url: `${siteUrl}/`, priority: "1.0", changefreq: "daily", lastmod: nowIso },
      { url: `${siteUrl}/search`, priority: "0.9", changefreq: "daily", lastmod: nowIso },
      { url: `${siteUrl}/assistant`, priority: "0.9", changefreq: "daily", lastmod: nowIso },
      { url: `${siteUrl}/compare`, priority: "0.8", changefreq: "weekly", lastmod: nowIso },
    ];

    // Fetch all active localities from MongoDB
    const localities = await db.collection("localities").find().project({ _id: 1, slug: 1, updated_at: 1 }).toArray();
    const localityRoutes = localities.map((loc) => {
      const slug = loc.slug || String(loc._id).replace("loc-", "");
      return {
        url: `${siteUrl}/locality/${slug}`,
        priority: "0.9",
        changefreq: "weekly",
        lastmod: nowIso,
      };
    });

    // Fetch top active properties for indexing
    const properties = await db.collection("properties")
      .find({ is_active: { $ne: false } })
      .project({ _id: 1, updated_at: 1 })
      .limit(5000)
      .toArray();

    const propertyRoutes = properties.map((prop) => ({
      url: `${siteUrl}/property/${prop._id}`,
      priority: "0.8",
      changefreq: "daily",
      lastmod: nowIso,
    }));

    const allUrls = [...staticRoutes, ...localityRoutes, ...propertyRoutes];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (item) => `  <url>
    <loc>${item.url}</loc>
    <lastmod>${item.lastmod || nowIso}</lastmod>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

// Router endpoints under /api/v1/seo
seoRouter.get("/ads.txt", handleAdsTxt);
seoRouter.get("/robots.txt", handleRobotsTxt);
seoRouter.get("/sitemap.xml", handleSitemapXml);

/**
 * GET /api/v1/seo/brand-metadata
 * Official branding details, domain, and contact channels
 */
seoRouter.get("/brand-metadata", (_req: Request, res: Response): void => {
  res.json({
    site_name: config.SITE_NAME,
    site_tagline: "ठिकाना खोजो - Find Your Ideal Home & Relocation Intelligence",
    domain: config.SITE_DOMAIN,
    url: config.SITE_URL,
    contact_email: config.CONTACT_EMAIL,
    support_email: config.CONTACT_EMAIL,
    supported_cities: ["Kolkata", "Bengaluru", "Pune", "Mumbai", "Delhi NCR"],
    adsense_publisher_id: config.ADSENSE_PUB_ID,
  });
});

/**
 * GET /api/v1/seo/schema-org
 * Google Rich Results JSON-LD Structured Data
 */
seoRouter.get("/schema-org", (_req: Request, res: Response): void => {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${config.SITE_URL}/#organization`,
        "name": config.SITE_NAME,
        "alternateName": ["Thikana Khojo", "ठिकाना खोजो", "ঠিকানা খোঁজো"],
        "url": config.SITE_URL,
        "logo": `${config.SITE_URL}/logo.png`,
        "email": config.CONTACT_EMAIL,
        "contactPoint": [
          {
            "@type": "ContactPoint",
            "email": config.CONTACT_EMAIL,
            "contactType": "customer support",
            "areaServed": "IN",
            "availableLanguage": ["English", "Hindi", "Bengali"],
          },
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${config.SITE_URL}/#website`,
        "url": config.SITE_URL,
        "name": config.SITE_NAME,
        "publisher": {
          "@id": `${config.SITE_URL}/#organization`,
        },
        "potentialAction": {
          "@type": "SearchAction",
          "target": `${config.SITE_URL}/search?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  res.setHeader("Content-Type", "application/ld+json; charset=utf-8");
  res.json(schema);
});
