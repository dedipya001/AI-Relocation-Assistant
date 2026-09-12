import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { MongoClient } from "mongodb";
import { config } from "../src/core/config.js";
import { cityPartition } from "../src/data/multiCity.js";

const CITIES = ["Bengaluru", "Pune", "Hyderabad"];

function runScraper(city:string, output:string):Promise<void>{
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,["--import","tsx","scripts/populatePropertyData.ts","--city",city,"--max-pages","2","--dry-run","--export-json",output],{cwd:process.cwd(),stdio:"inherit"});
    child.once("error",reject);child.once("exit",(code)=>code===0?resolve():reject(new Error(`Scraper exited ${code} for ${city}`)));
  });
}

async function main(){
  const client=new MongoClient(config.MONGODB_URI);await client.connect();const db=client.db(config.MONGODB_DB);
  try{
    for(const city of CITIES){
      const output=path.join(os.tmpdir(),`relocation-${city.toLowerCase()}-${Date.now()}.json`);
      await runScraper(city,output);
      const rows=JSON.parse(await fs.readFile(output,"utf8")) as any[];
      const collection=db.collection(cityPartition(city));
      for(const row of rows){await collection.updateOne({dedupe_key:row.dedupe_key},{$set:{...row,city,is_active:true,updated_at:new Date().toISOString()}},{upsert:true});}
      await collection.createIndex({location:"2dsphere"});await collection.createIndex({dedupe_key:1},{unique:true});await collection.createIndex({city:1,locality_id:1,rent:1});
      await fs.unlink(output).catch(()=>undefined);
      console.log(`[${city}] upserted ${rows.length} scraped properties into ${cityPartition(city)}`);
    }
  } finally { await client.close(); }
}
main().catch((error)=>{console.error(error);process.exit(1);});
