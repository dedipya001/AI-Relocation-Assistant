type ProviderListingLike = {
  source_platform?: string | null;
  source?: string | null;
  source_url?: string | null;
  listing_url?: string | null;
  provider_url?: string | null;
  city?: string | null;
  locality?: string | null;
  title?: string | null;
};

function validHttpUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/bengaluru/g, "bangalore").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function sourceName(item: ProviderListingLike) {
  return String(item.source_platform ?? item.source ?? "").trim().toLowerCase();
}

export function resolveProviderListingUrl(item: ProviderListingLike): string | null {
  const direct = validHttpUrl(item.listing_url) ?? validHttpUrl(item.source_url);
  if (direct) return direct;
  const source = sourceName(item);
  const city = slug(String(item.city || "kolkata")) || "kolkata";
  if (source.includes("magicbricks")) return `https://www.magicbricks.com/property-for-rent-in-${city}-pppfr`;
  if (source.includes("nobroker")) return `https://www.nobroker.in/property/rent/${city}/all`;
  if (source.includes("housing")) return `https://housing.com/rent/property-for-rent-in-${city}`;
  if (source.includes("99acres") || source.includes("acres99")) return `https://www.99acres.com/search/property/rent/${city}?res_com=R&preference=R`;
  if (source.includes("telegram")) return validHttpUrl(item.provider_url) ?? "https://t.me/";
  return validHttpUrl(item.provider_url);
}

export function attachProviderUrls<T extends Record<string, any>>(item: T): T & { listing_url:string|null; source_url:string|null; provider_url:string|null } {
  const direct = validHttpUrl(item.source_url) ?? validHttpUrl(item.listing_url);
  const provider = resolveProviderListingUrl({ ...item, source_url: null, listing_url: null });
  const listing = direct ?? provider;
  return Object.assign(item, { listing_url: listing, source_url: direct ?? provider, provider_url: provider ?? listing });
}

export function attachRecommendationProviderUrls<T extends Record<string, any>>(
  recommendations: T[],
  properties: Record<string, any>[]
): T[] {
  const byId = new Map(properties.map((property) => [String(property._id), property]));
  return recommendations.map((recommendation) => {
    const property = byId.get(String(recommendation.entity_id));
    if (!property) return recommendation;
    attachProviderUrls(property);
    return Object.assign(recommendation, {
      source_platform: property.source_platform ?? null,
      source_url: property.source_url ?? null,
      listing_url: property.listing_url ?? null,
      provider_url: property.provider_url ?? null,
    });
  });
}
