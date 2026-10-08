import { NextResponse } from "next/server";
import { allLocalities } from "@/lib/json-catalog";
export async function GET(_request:Request, context:{params:Promise<{id:string}>}) {
 const {id}=await context.params;const record=allLocalities().find(p=>p._id===id || p.slug===id);
 return record ? NextResponse.json(record) : NextResponse.json({error:"Locality not found"},{status:404});
}
