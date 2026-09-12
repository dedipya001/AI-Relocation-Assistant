"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import type { HardConstraints, ScoringProfile, SearchResponse } from "@/types";

export type SupportedCity = "Kolkata" | "Bengaluru" | "Pune" | "Hyderabad";
const DEFAULT_QUERIES:Record<SupportedCity,string>={
  Kolkata:"I work in Sector V Kolkata, budget is 15k, need peaceful place, fast internet, good food nearby.",
  Bengaluru:"I work in Bengaluru, budget is 25k, need a reliable commute to a tech park and fast internet.",
  Pune:"I work near Hinjewadi Pune, budget is 22k, want metro or bus access and a calm neighborhood.",
  Hyderabad:"I work near Hitec City Hyderabad, budget is 25k, need safe housing with reliable internet and short commute.",
};

type SearchState={query:string;response?:SearchResponse;isLoading:boolean;error?:string;selectedProfile:ScoringProfile;hardConstraints:Partial<HardConstraints>;selectedCity:SupportedCity;cityQueries:Record<SupportedCity,string>;setQuery:(query:string)=>void;setCity:(city:SupportedCity)=>Promise<void>;setSelectedProfile:(profile:ScoringProfile)=>Promise<void>;setHardConstraints:(constraints:Partial<HardConstraints>)=>Promise<void>;runSearch:(query?:string,profile?:ScoringProfile,constraints?:Partial<HardConstraints>)=>Promise<void>;};

export const useSearchStore=create<SearchState>()(persist((set,get)=>({
  query:DEFAULT_QUERIES.Kolkata,isLoading:false,selectedProfile:"balanced",hardConstraints:{},selectedCity:"Kolkata",cityQueries:{...DEFAULT_QUERIES},
  setQuery:(query)=>set((state)=>({query,cityQueries:{...state.cityQueries,[state.selectedCity]:query}})),
  setCity:async(selectedCity)=>{const current=get();const cityQueries={...current.cityQueries,[current.selectedCity]:current.query};const query=cityQueries[selectedCity]||DEFAULT_QUERIES[selectedCity];set({selectedCity,query,cityQueries});if(current.response)await get().runSearch(query);},
  setSelectedProfile:async(selectedProfile)=>{set({selectedProfile});await get().runSearch(get().query,selectedProfile,get().hardConstraints);},
  setHardConstraints:async(hardConstraints)=>{set({hardConstraints});await get().runSearch(get().query,get().selectedProfile,hardConstraints);},
  runSearch:async(query,profile,constraints)=>{const state=get();let activeQuery=query??state.query;const activeProfile=profile??state.selectedProfile;const activeConstraints=constraints??state.hardConstraints;if(!activeQuery.toLowerCase().includes(state.selectedCity.toLowerCase()))activeQuery=`${activeQuery} City: ${state.selectedCity}.`;set((s)=>({isLoading:true,error:undefined,query:activeQuery,cityQueries:{...s.cityQueries,[s.selectedCity]:activeQuery}}));try{const response=await api.search(activeQuery,{profile:activeProfile,hard_constraints:activeConstraints});set({response,isLoading:false});}catch(error){set({error:error instanceof Error?error.message:"Search failed",isLoading:false});}}
}),{name:"relocation-search-v2",partialize:(state)=>({query:state.query,selectedProfile:state.selectedProfile,hardConstraints:state.hardConstraints,selectedCity:state.selectedCity,cityQueries:state.cityQueries})}));
