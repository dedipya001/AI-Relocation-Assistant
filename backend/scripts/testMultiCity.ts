import { MongoClient } from "mongodb";
import { config } from "../src/core/config.js";
import { PropertyRepository } from "../src/repositories/properties.js";

async function main(){
  const client=new MongoClient(config.MONGODB_URI);await client.connect();
  try{
    const repo=new PropertyRepository(client.db(config.MONGODB_DB));
    for(const city of ["Bengaluru","Pune","Hyderabad"]){
      const rows=await repo.search({city,office_location:null,budget_max:null,property_types:[],locality_ids:[],amenities:[],transport_modes:[],preferences:[]},100);
      if(rows.length===0)throw new Error(`Expected seeded ${city} properties`);
      if(rows.some((row)=>String(row.city).toLowerCase()!==city.toLowerCase()))throw new Error(`${city} query leaked another city partition`);
      console.log(`${city}: ${rows.length} partitioned properties verified`);
    }
    const collections=await repo.getPropertyCollections();
    const names=collections.map((collection:any)=>collection.collectionName);
    for(const expected of ["properties_bangalore","properties_pune","properties_hyderabad"]){if(!names.includes(expected))throw new Error(`Missing ${expected}`);}
    console.log("Multi-city partition validation passed");
  } finally {await client.close();}
}
main().catch((error)=>{console.error(error);process.exit(1);});
