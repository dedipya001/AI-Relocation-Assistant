import { NextResponse } from "next/server";
import { findProperty } from "@/lib/json-catalog";
export async function GET(_request:Request, context:{params:Promise<{id:string}>}) {
 const {id}=await context.params;const record=findProperty(id);
 return record ? NextResponse.json(record) : NextResponse.json({error:"Property not found"},{status:404});
}
