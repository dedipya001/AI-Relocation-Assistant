import { NextResponse } from "next/server";
import { allProperties } from "@/lib/json-catalog";
export function GET() { return NextResponse.json(allProperties().slice(0,250)); }
