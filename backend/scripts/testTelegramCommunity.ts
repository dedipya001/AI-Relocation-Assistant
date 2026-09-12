import assert from "node:assert/strict";
import { connectMongo, closeMongo } from "../src/db/mongo.js";
import { ingestTelegramUpdate, parseCommunityListing } from "../src/services/communityTelegram.js";

const samples = [
  {
    chat: "Flats & Flatmates Bangalore",
    text: "2BHK fully furnished in HSR Layout near HSR Sector 2 park. Rent 25k/month. Female preferred. No Brokerage. Contact @flat_owner",
    expected: { city: "Bengaluru", locality: "HSR Layout", rent: 25000, property_type: "apartment", furnishing: "fully furnished", gender_preference: "female" },
  },
  {
    chat: "Flats and Flatmates Hyderabad",
    text: "Private room in 3BHK, Kondapur Hyderabad, ₹14,000 incl maintenance. Master bedroom, male preferred. Call +919876543210",
    expected: { city: "Hyderabad", locality: "Kondapur", rent: 14000, property_type: "shared flat", gender_preference: "male" },
  },
  {
    chat: "Flats & Flatmates Pune",
    text: "1 RK available in Kharadi Pune near EON IT Park. Rent 18000 per month. Semi furnished, owner direct.",
    expected: { city: "Pune", locality: "Kharadi", rent: 18000, property_type: "studio", furnishing: "semi-furnished" },
  },
  {
    chat: "Flats and Flatmates Kolkata",
    text: "PG available Salt Lake Sector V Kolkata near Wipro More. Rs 9,500 pm, no brokerage.",
    expected: { city: "Kolkata", locality: "Sector V", rent: 9500, property_type: "PG" },
  },
];

for (const sample of samples) {
  const parsed = parseCommunityListing(sample.text, sample.chat);
  assert(parsed, `Expected listing to parse: ${sample.text}`);
  for (const [key, value] of Object.entries(sample.expected)) {
    assert.equal((parsed as any)[key], value, `${sample.chat}: expected ${key}=${value}`);
  }
}

assert.equal(
  parseCommunityListing("Looking for 2BHK in Whitefield Bangalore, budget 30k. Please DM.", "Flats & Flatmates Bangalore"),
  null,
  "wanted posts must be rejected"
);

const privacySample = parseCommunityListing(samples[0].text, samples[0].chat)!;
assert.equal(privacySample.contact_masked, "@fl***", "Telegram username must be masked");
assert(!privacySample.normalized_text.includes("https://"), "URLs must be stripped from canonical dedupe text");

async function run() {
  const db = await connectMongo();
  const text = "2BHK fully furnished in HSR Layout Bangalore near HSR Sector 2 park. Rent 25k/month. Female preferred. No Brokerage. Contact @flat_owner";
  const parsed = parseCommunityListing(text, "Flats & Flatmates Bangalore")!;
  const dedupeKey = `telegram:${parsed.content_hash}`;

  await db.collection("community_ingest_events").deleteMany({ content_hash: parsed.content_hash });
  await db.collection("properties_bangalore").deleteMany({ dedupe_key: dedupeKey });
  await db.collection("properties").deleteMany({ dedupe_key: dedupeKey });

  const update = {
    update_id: 91001,
    channel_post: {
      message_id: 812,
      date: Math.floor(Date.now() / 1000),
      text,
      chat: { id: -100123, title: "Flats & Flatmates Bangalore", username: "flats_bangalore_public", type: "channel" },
    },
  };

  const first = await ingestTelegramUpdate(update);
  assert.equal(first.accepted, true);
  assert.equal((first as any).duplicate, false);
  assert.equal((first as any).partition, "properties_bangalore");

  const stored = await db.collection("properties_bangalore").findOne({ dedupe_key: dedupeKey });
  assert(stored, "accepted community listing must be stored in Bengaluru partition");
  assert.equal(stored.source_platform, "Telegram");
  assert.equal(stored.is_peer_to_peer, true);
  assert.equal(stored.contact_masked, "@fl***");
  assert.equal(stored.raw_text, undefined, "raw message text must not be persisted");
  assert(Array.isArray(stored.location?.coordinates), "listing must receive geocoded/locality coordinates");

  const defaultStored = await db.collection("properties").findOne({ dedupe_key: dedupeKey });
  assert(defaultStored, "accepted community listing must also be available in default property collection");

  const second = await ingestTelegramUpdate(update);
  assert.equal(second.accepted, true);
  assert.equal((second as any).duplicate, true, "repeat message within seven days must dedupe");

  await db.collection("community_ingest_events").deleteMany({ content_hash: parsed.content_hash });
  await db.collection("properties_bangalore").deleteMany({ dedupe_key: dedupeKey });
  await db.collection("properties").deleteMany({ dedupe_key: dedupeKey });
  await closeMongo();
  console.log("Telegram community parser, privacy, partition ingestion and 7-day dedupe checks passed.");
}

run().catch(async (error) => {
  console.error(error);
  await closeMongo().catch(() => undefined);
  process.exit(1);
});
