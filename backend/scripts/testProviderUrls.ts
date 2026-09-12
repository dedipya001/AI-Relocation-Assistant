import assert from "node:assert/strict";
import { LowestPriceEngine } from "../src/services/lowestPrice.js";
import { attachRecommendationProviderUrls, resolveProviderListingUrl } from "../src/services/providerUrls.js";

const direct = "https://www.magicbricks.com/propertyDetails/example-listing";
assert.equal(resolveProviderListingUrl({ source_platform: "MagicBricks", source_url: direct, city: "Kolkata" }), direct);
assert.equal(resolveProviderListingUrl({ source_platform: "MagicBricks", city: "Kolkata" }), "https://www.magicbricks.com/property-for-rent-in-kolkata-pppfr");
assert.equal(resolveProviderListingUrl({ source_platform: "NoBroker", city: "Bengaluru" }), "https://www.nobroker.in/property/rent/bangalore/all");
assert.equal(resolveProviderListingUrl({ source_platform: "Housing", city: "Hyderabad" }), "https://housing.com/rent/property-for-rent-in-hyderabad");
assert.equal(resolveProviderListingUrl({ source_platform: "99acres", city: "Pune" }), "https://www.99acres.com/search/property/rent/pune?res_com=R&preference=R");

const property = new LowestPriceEngine().attachLowestPrice({
  _id: "provider-test",
  title: "2BHK test home",
  source_platform: "MagicBricks",
  source_url: null,
  city: "Kolkata",
  locality: "New Town",
  rent: 22000,
  created_at: "2026-09-12T00:00:00.000Z",
  price_history: [{ source: "Housing", rent: 21000, url: null, observed_at: "2026-09-12T00:00:00.000Z" }],
});
assert.equal(property.listing_url, "https://www.magicbricks.com/property-for-rent-in-kolkata-pppfr");
assert.equal(property.source_url, property.listing_url);
assert.equal(property.provider_url, property.listing_url);
assert.equal(property.lowest_price.url, "https://housing.com/rent/property-for-rent-in-kolkata");

const recommendations = attachRecommendationProviderUrls(
  [{ entity_id: "provider-test", title: "2BHK test home" }],
  [property]
);
assert.equal(recommendations[0].source_platform, "MagicBricks");
assert.equal(recommendations[0].listing_url, property.listing_url);
assert.equal(recommendations[0].provider_url, property.provider_url);

for (const url of [property.listing_url, property.provider_url, property.lowest_price.url]) {
  assert(url && new URL(url).protocol === "https:", `Expected safe HTTPS provider URL, got ${url}`);
}

console.log("Provider URL direct-link preference, portal fallbacks, lowest-price URLs and recommendation metadata passed.");
