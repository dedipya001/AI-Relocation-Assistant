import { NextResponse } from "next/server";
import { searchCatalog } from "@/lib/json-catalog";
import type { ScoringWeights } from "@/types";
export async function POST(request:Request) {
 const body=await request.json().catch(()=>({})) as {query?:string;weights?:Partial<ScoringWeights>;hard_constraints?:{max_budget?:number|null}};
 return NextResponse.json(searchCatalog(body.query || "Kolkata",body.hard_constraints?.max_budget || undefined,body.weights));
}
