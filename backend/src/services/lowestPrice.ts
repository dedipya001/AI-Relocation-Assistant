import { PriceObservation } from "../models/property.js";
import { resolveProviderListingUrl } from "./recommendations.js";

export class LowestPriceEngine {
  attachLowestPrice(propertyDoc: Record<string, any>): Record<string, any> {
    const verifiedUrl = resolveProviderListingUrl(propertyDoc);
    propertyDoc.source_url = propertyDoc.source_url || verifiedUrl;
    propertyDoc.listing_url = propertyDoc.listing_url || verifiedUrl;
    propertyDoc.provider_url = propertyDoc.provider_url || verifiedUrl;

    const observations: PriceObservation[] = [
      {
        source: propertyDoc.source_platform || "MagicBricks",
        rent: propertyDoc.rent,
        url: propertyDoc.source_url || verifiedUrl,
        observed_at: propertyDoc.created_at || new Date().toISOString(),
      },
    ];

    if (Array.isArray(propertyDoc.price_history)) {
      for (const item of propertyDoc.price_history) {
        if (item && typeof item.rent === "number") {
          observations.push({
            source: item.source || propertyDoc.source_platform || "MagicBricks",
            rent: item.rent,
            url: item.url || verifiedUrl,
            observed_at: item.observed_at || new Date().toISOString(),
          });
        }
      }
    }

    let lowest = observations[0];
    for (const obs of observations) {
      if (obs.rent < lowest.rent) {
        lowest = obs;
      }
    }

    propertyDoc.lowest_price = lowest;
    return propertyDoc;
  }
}
