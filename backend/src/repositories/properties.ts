import { Db, Filter } from "mongodb";
import { PropertySearchFilters } from "../models/property.js";
import { MongoRepository, serializeDoc } from "./base.js";
import { cityPartition } from "../data/multiCity.js";

export class PropertyRepository extends MongoRepository {
  protected db:Db; public static readonly COLLECTION_NAME="properties";
  constructor(db:Db){super(db.collection(PropertyRepository.COLLECTION_NAME));this.db=db;}

  async search(filters:PropertySearchFilters,limit:number=40):Promise<any[]>{
    const query:Filter<any>={};if(filters.budget_max)query.rent={$lte:filters.budget_max};if(filters.property_types?.length)query.property_type={$in:filters.property_types};if(filters.locality_ids?.length)query.locality_id={$in:filters.locality_ids};if(filters.amenities?.length)query.amenities={$all:filters.amenities};if(filters.city)query.city={$regex:new RegExp(`^${filters.city.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}$`,`i`)};
    const collections=await this.getPropertyCollections(filters.city||undefined);const perCollectionLimit=Math.max(limit,100);const docs:any[]=[];
    for(const coll of collections){const results=await coll.find(query).sort({rent:1}).limit(perCollectionLimit).toArray();docs.push(...results);}
    docs.sort((a,b)=>(a.rent||0)-(b.rent||0));return docs.slice(0,limit).map(serializeDoc);
  }

  async getPropertyCollections(city?:string):Promise<any[]>{
    const collections=await this.db.listCollections().toArray();const names=collections.map((c)=>c.name);
    if(city){const partition=cityPartition(city);const cityCollections=names.filter((name)=>name===partition);if(cityCollections.length)return cityCollections.map((name)=>this.db.collection(name));}
    const propertyCollectionNames=names.filter((name)=>name===PropertyRepository.COLLECTION_NAME||name.startsWith("properties_")).sort();
    if(propertyCollectionNames.length===0)return[this.collection];return propertyCollectionNames.map((name)=>this.db.collection(name));
  }

  async upsertByDedupeKey(payload:Record<string,any>):Promise<any>{const now=new Date();const{created_at,...updateFields}=payload;await this.collection.updateOne({dedupe_key:payload.dedupe_key},{$set:updateFields,$setOnInsert:{created_at:created_at||now}},{upsert:true});const doc=await this.collection.findOne({dedupe_key:payload.dedupe_key});return serializeDoc(doc)||payload;}
}
