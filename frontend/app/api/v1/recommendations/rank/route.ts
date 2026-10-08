import { NextResponse } from "next/server";
import { searchCatalog } from "@/lib/json-catalog";
import type { ScoringWeights } from "@/types";
export async function POST(request:Request) {
 const body=await request.json().catch(()=>({})) as {budget_max?:number;weights?:Partial<ScoringWeights>;properties?:{city?:string}[]};
 const city=body.properties?.[0]?.city || "Kolkata";
 const result=searchCatalog(city,body.budget_max,body.weights);
 return NextResponse.json({profile:"balanced",weights:body.weights||{},total_candidates:result.properties.length,recommendations:result.recommendations});
}
