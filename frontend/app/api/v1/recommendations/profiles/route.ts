import { NextResponse } from "next/server";
const profiles=["balanced","budget_saver","tech_professional","safety_priority","family_first","night_owl"] as const;
const standard={affordability:.22,commute:.22,safety:.20,internet:.14,food_access:.10,lifestyle_fit:.07,property_quality:.05};
export function GET(){return NextResponse.json({profiles,presets:Object.fromEntries(profiles.map(profile=>[profile,standard]))});}
