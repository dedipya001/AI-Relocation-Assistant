"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import type { HardConstraints, ScoringProfile, ScoringWeights, SearchResponse } from "@/types";

export type SupportedCity = "Kolkata" | "Bengaluru" | "Pune" | "Hyderabad";
export const SUPPORTED_CITIES: SupportedCity[] = ["Kolkata", "Bengaluru", "Pune", "Hyderabad"];
const DEFAULT_QUERIES:Record<SupportedCity,string>={
  Kolkata:"I work in Sector V Kolkata, budget is 15k, need peaceful place, fast internet, good food nearby.",
  Bengaluru:"I work in Bengaluru, budget is 25k, need a reliable commute to a tech park and fast internet.",
  Pune:"I work near Hinjewadi Pune, budget is 22k, want metro or bus access and a calm neighborhood.",
  Hyderabad:"I work near Hitec City Hyderabad, budget is 25k, need safe housing with reliable internet and short commute.",
};

function supportedCity(value:string):SupportedCity|undefined {
  return SUPPORTED_CITIES.find((city)=>city.toLowerCase()===value.toLowerCase());
}

type PersonalizationInput={profile:ScoringProfile;weights:Partial<ScoringWeights>;budgetMax?:number|null;city?:string;priorities?:string[];};
type SearchState={query:string;response?:SearchResponse;isLoading:boolean;error?:string;selectedProfile:ScoringProfile;personalizedWeights?:Partial<ScoringWeights>;hardConstraints:Partial<HardConstraints>;selectedCity:SupportedCity;cityQueries:Record<SupportedCity,string>;setQuery:(query:string)=>void;setCity:(city:SupportedCity)=>Promise<void>;setSelectedProfile:(profile:ScoringProfile)=>Promise<void>;setHardConstraints:(constraints:Partial<HardConstraints>)=>Promise<void>;applyPersonalization:(input:PersonalizationInput)=>Promise<void>;clearPersonalization:()=>void;runSearch:(query?:string,profile?:ScoringProfile,constraints?:Partial<HardConstraints>,weights?:Partial<ScoringWeights>)=>Promise<void>;};

export const useSearchStore=create<SearchState>()(persist((set,get)=>({
  query:DEFAULT_QUERIES.Kolkata,isLoading:false,selectedProfile:"balanced",personalizedWeights:undefined,hardConstraints:{},selectedCity:"Kolkata",cityQueries:{...DEFAULT_QUERIES},
  setQuery:(query)=>set((state)=>({query,cityQueries:{...state.cityQueries,[state.selectedCity]:query}})),
  setCity:async(selectedCity)=>{const current=get();const cityQueries={...current.cityQueries,[current.selectedCity]:current.query};const query=cityQueries[selectedCity]||DEFAULT_QUERIES[selectedCity];set({selectedCity,query,cityQueries});if(current.response)await get().runSearch(query);},
  setSelectedProfile:async(selectedProfile)=>{set({selectedProfile,personalizedWeights:undefined});await get().runSearch(get().query,selectedProfile,get().hardConstraints,undefined);},
  setHardConstraints:async(hardConstraints)=>{set({hardConstraints});await get().runSearch(get().query,get().selectedProfile,hardConstraints,get().personalizedWeights);},
  applyPersonalization:async(input)=>{
    const current=get();
    const selectedCity=input.city?supportedCity(input.city)??current.selectedCity:current.selectedCity;
    const hardConstraints={...current.hardConstraints,...(input.budgetMax?{max_budget:input.budgetMax}:{})};
    let query=current.cityQueries[selectedCity]||DEFAULT_QUERIES[selectedCity];
    if(input.priorities?.length){const marker=` Priorities: ${input.priorities.join(", ")}.`;if(!query.includes("Priorities:"))query=`${query}${marker}`;else query=query.replace(/ Priorities:.*?\.(?= |$)/,marker);}
    const cityQueries={...current.cityQueries,[current.selectedCity]:current.query,[selectedCity]:query};
    set({selectedCity,query,cityQueries,selectedProfile:input.profile,personalizedWeights:input.weights,hardConstraints});
    await get().runSearch(query,input.profile,hardConstraints,input.weights);
  },
  clearPersonalization:()=>set({selectedProfile:"balanced",personalizedWeights:undefined}),
  runSearch:async(query,profile,constraints,weights)=>{const state=get();let activeQuery=query??state.query;const activeProfile=profile??state.selectedProfile;const activeConstraints=constraints??state.hardConstraints;const activeWeights=weights??state.personalizedWeights;if(!activeQuery.toLowerCase().includes(state.selectedCity.toLowerCase()))activeQuery=`${activeQuery} City: ${state.selectedCity}.`;set((s)=>({isLoading:true,error:undefined,query:activeQuery,cityQueries:{...s.cityQueries,[s.selectedCity]:activeQuery}}));try{const response=await api.search(activeQuery,{profile:activeProfile,weights:activeWeights,hard_constraints:activeConstraints});set({response,isLoading:false});}catch(error){set({error:error instanceof Error?error.message:"Search failed",isLoading:false});}}
}),{name:"relocation-search-v2",partialize:(state)=>({query:state.query,selectedProfile:state.selectedProfile,personalizedWeights:state.personalizedWeights,hardConstraints:state.hardConstraints,selectedCity:state.selectedCity,cityQueries:state.cityQueries})}));
