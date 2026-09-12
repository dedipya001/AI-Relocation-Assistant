import { MongoClient } from "mongodb";
import { config } from "../src/core/config.js";
import { CITY_OFFICE_HUBS, CITY_TRANSIT, MULTI_CITY_LOCALITIES, cityPartition } from "../src/data/multiCity.js";

const now = new Date().toISOString();

function sampleProperty(locality:any, index:number){
  const city = locality.city as string;
  const monthlyBase = city === "Bengaluru" ? 22000 : city === "Pune" ? 18000 : 20000;
  const rent = monthlyBase + (index % 5) * 1800;
  const office = CITY_OFFICE_HUBS[city as keyof typeof CITY_OFFICE_HUBS]?.[0];
  return {
    title:`${index % 2 ? "1BHK" : "Shared flat"} in ${locality.name}`,
    source_platform:"MagicBricks",
    source_url:null,
    property_type:index % 2 ? "apartment" : "shared flat",
    rent,
    deposit:rent * 2,
    area_sqft:index % 2 ? 560 : 220,
    furnishing:"semi-furnished",
    images:[],
    amenities:["internet","security","power backup"],
    location:locality.location,
    locality_id:locality._id,
    city,
    locality:locality.name,
    nearby_metro:(locality.transit || []).find((item:string)=>item.toLowerCase().includes("line")) ?? null,
    commute_estimate_minutes:office ? 25 + (index % 4) * 5 : null,
    dedupe_key:`seed:${locality._id}:sample`,
    price_history:[],
    created_at:now,
    updated_at:now,
    is_active:true,
    ingestion_method:"multi-city-seed",
  };
}

async function run(){
  const client = new MongoClient(config.MONGODB_URI);
  try{
    await client.connect();
    const db = client.db(config.MONGODB_DB);
    const localities = db.collection("localities");
    for(const locality of MULTI_CITY_LOCALITIES){
      const city = locality.city as keyof typeof CITY_TRANSIT;
      await localities.updateOne(
        { _id: locality._id as any },
        { $set: { ...locality, city_transit:CITY_TRANSIT[city], office_hubs:CITY_OFFICE_HUBS[city], updated_at:now } },
        { upsert:true }
      );
    }
    await localities.createIndex({ location:"2dsphere" });
    await localities.createIndex({ city:1, slug:1 }, { unique:true });

    for(const city of ["Bengaluru","Pune","Hyderabad"]){
      const collection = db.collection(cityPartition(city));
      const cityLocalities = MULTI_CITY_LOCALITIES.filter((item)=>item.city===city);
      for(const [index, locality] of cityLocalities.entries()){
        const property = sampleProperty(locality,index);
        await collection.updateOne({ dedupe_key:property.dedupe_key }, { $set:property }, { upsert:true });
      }
      await collection.createIndex({ location:"2dsphere" });
      await collection.createIndex({ dedupe_key:1 }, { unique:true });
      await collection.createIndex({ city:1, locality_id:1, rent:1 });
    }
    console.log(`Seeded ${MULTI_CITY_LOCALITIES.length} multi-city localities and city property partitions.`);
  } finally {
    await client.close();
  }
}

run().catch((error)=>{ console.error("Multi-city seed failed",error); process.exit(1); });
