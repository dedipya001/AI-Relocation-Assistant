import { PriceObservation } from "../models/property.js";
import { attachProviderUrls, resolveProviderListingUrl } from "./providerUrls.js";

export class LowestPriceEngine {
  attachLowestPrice(propertyDoc: Record<string, any>): Record<string, any> {
    attachProviderUrls(propertyDoc);
    const observations: PriceObservation[] = [
      {
        source: propertyDoc.source_platform,
        rent: propertyDoc.rent,
        url: propertyDoc.listing_url || propertyDoc.source_url || propertyDoc.provider_url || null,
        observed_at: propertyDoc.created_at || new Date().toISOString(),
      },
    ];

    if (Array.isArray(propertyDoc.price_history)) {
      for (const item of propertyDoc.price_history) {
        if (item && typeof item.rent === "number") {
          observations.push({
            source: item.source,
            rent: item.rent,
            url:
              item.url ||
              resolveProviderListingUrl({
                source: item.source,
                city: propertyDoc.city,
                locality: propertyDoc.locality,
                title: propertyDoc.title,
              }) ||
              null,
            observed_at: item.observed_at || new Date().toISOString(),
          });
        }
      }
    }

    let lowest = observations[0];
    for (const obs of observations) {
      if (obs.rent < lowest.rent) lowest = obs;
    }

    propertyDoc.lowest_price = lowest;
    return propertyDoc;
  }
}
