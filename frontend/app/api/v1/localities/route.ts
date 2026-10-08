import { NextResponse } from "next/server";
import { allLocalities } from "@/lib/json-catalog";
export function GET() { return NextResponse.json(allLocalities()); }
