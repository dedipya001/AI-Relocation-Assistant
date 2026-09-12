"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import { useSearchStore, type SupportedCity } from "@/store/search-store";
import type { AuthResponse, GuestPersonalization, GuestProfile } from "@/types";

export type QuickRole = "student" | "tech" | "family" | "executive";
export type LoginGateReason = "shortlist" | "price_alert" | "sync" | "profile";

const ROLE_DEFAULTS:Record<QuickRole,Pick<GuestProfile,"age_group"|"profession"|"target_budget">>={
  student:{age_group:"18-24",profession:"Student / Intern",target_budget:18000},
  tech:{age_group:"25-32",profession:"Software Engineer",target_budget:30000},
  family:{age_group:"33-45",profession:"Family",target_budget:45000},
  executive:{age_group:"46+",profession:"Executive",target_budget:60000},
};

function baseProfile(city:SupportedCity):GuestProfile {
  return {age_group:"25-32",gender:"prefer-not-to-say",profession:"Professional",target_budget:30000,preferred_city:city,priority_amenities:[]};
}

type UserProfileState={
  guestProfile?:GuestProfile;
  guestSavedProperties:string[];
  personalization?:GuestPersonalization;
  isDismissed:boolean;
  authToken?:string;
  userEmail?:string;
  profileModalOpen:boolean;
  loginModalOpen:boolean;
  loginGateReason?:LoginGateReason;
  authLoading:boolean;
  authError?:string;
  setProfileModalOpen:(open:boolean)=>void;
  requestLogin:(reason:LoginGateReason)=>void;
  closeLogin:()=>void;
  dismissTailor:()=>void;
  setGuestProfile:(profile:GuestProfile)=>Promise<void>;
  selectRole:(role:QuickRole)=>Promise<void>;
  togglePriority:(priority:string)=>Promise<void>;
  addGuestSavedProperty:(propertyId:string)=>void;
  removeGuestSavedProperty:(propertyId:string)=>void;
  signupWithEmail:(email:string,password:string)=>Promise<void>;
  loginWithEmail:(email:string,password:string)=>Promise<void>;
  loginWithGoogleCredential:(credential:string)=>Promise<void>;
  signOut:()=>void;
};

async function applyPersonalization(profile:GuestProfile){
  const personalization=await api.personalizeGuest(profile);
  await useSearchStore.getState().applyPersonalization({
    profile:personalization.scoring_profile,
    weights:personalization.weights,
    budgetMax:personalization.recommended_filters.budget_max,
    city:personalization.recommended_filters.city,
    priorities:personalization.recommended_filters.priority_amenities,
  });
  return personalization;
}

async function migrateGuestState(token:string,profile:GuestProfile|undefined,propertyIds:string[]){
  if(profile){await api.updateMe(token,{profile});}
  for(const propertyId of [...new Set(propertyIds)]){
    await api.saveShortlistItem(token,propertyId);
  }
}

export const useUserProfileStore=create<UserProfileState>()(persist((set,get)=>({
  guestProfile:undefined,
  guestSavedProperties:[],
  personalization:undefined,
  isDismissed:false,
  authToken:undefined,
  userEmail:undefined,
  profileModalOpen:false,
  loginModalOpen:false,
  loginGateReason:undefined,
  authLoading:false,
  authError:undefined,
  setProfileModalOpen:(profileModalOpen)=>set({profileModalOpen}),
  requestLogin:(loginGateReason)=>set({loginModalOpen:true,loginGateReason,authError:undefined}),
  closeLogin:()=>set({loginModalOpen:false,loginGateReason:undefined,authError:undefined}),
  dismissTailor:()=>set({isDismissed:true}),
  setGuestProfile:async(guestProfile)=>{
    const personalization=await applyPersonalization(guestProfile);
    set({guestProfile,personalization,isDismissed:true});
  },
  selectRole:async(role)=>{
    const search=useSearchStore.getState();
    const current=get().guestProfile??baseProfile(search.selectedCity);
    const defaults=ROLE_DEFAULTS[role];
    const guestProfile={...current,...defaults,preferred_city:search.selectedCity};
    const personalization=await applyPersonalization(guestProfile);
    set({guestProfile,personalization,isDismissed:false});
  },
  togglePriority:async(priority)=>{
    const search=useSearchStore.getState();
    const current=get().guestProfile??baseProfile(search.selectedCity);
    const exists=current.priority_amenities.includes(priority);
    const guestProfile={...current,preferred_city:search.selectedCity,priority_amenities:exists?current.priority_amenities.filter((item)=>item!==priority):[...current.priority_amenities,priority]};
    const personalization=await applyPersonalization(guestProfile);
    set({guestProfile,personalization,isDismissed:false});
  },
  addGuestSavedProperty:(propertyId)=>set((state)=>({guestSavedProperties:state.guestSavedProperties.includes(propertyId)?state.guestSavedProperties:[...state.guestSavedProperties,propertyId]})),
  removeGuestSavedProperty:(propertyId)=>set((state)=>({guestSavedProperties:state.guestSavedProperties.filter((item)=>item!==propertyId)})),
  signupWithEmail:async(email,password)=>{
    set({authLoading:true,authError:undefined});
    try{
      const state=get();
      const response:AuthResponse=await api.signup({email,password,guest_profile:state.guestProfile,guest_saved_properties:state.guestSavedProperties});
      set({authToken:response.access_token,userEmail:response.user.email,guestSavedProperties:[],loginModalOpen:false,loginGateReason:undefined,authLoading:false});
    }catch(error){set({authLoading:false,authError:error instanceof Error?error.message:"Unable to create account"});throw error;}
  },
  loginWithEmail:async(email,password)=>{
    set({authLoading:true,authError:undefined});
    try{
      const state=get();
      const response=await api.login({email,password});
      await migrateGuestState(response.access_token,state.guestProfile,state.guestSavedProperties);
      set({authToken:response.access_token,userEmail:response.user.email,guestSavedProperties:[],loginModalOpen:false,loginGateReason:undefined,authLoading:false});
    }catch(error){set({authLoading:false,authError:error instanceof Error?error.message:"Unable to sign in"});throw error;}
  },
  loginWithGoogleCredential:async(credential)=>{
    set({authLoading:true,authError:undefined});
    try{
      const state=get();
      const response=await api.login({google_id_token:credential});
      await migrateGuestState(response.access_token,state.guestProfile,state.guestSavedProperties);
      set({authToken:response.access_token,userEmail:response.user.email,guestSavedProperties:[],loginModalOpen:false,loginGateReason:undefined,authLoading:false});
    }catch(error){set({authLoading:false,authError:error instanceof Error?error.message:"Unable to sign in with Google"});throw error;}
  },
  signOut:()=>set({authToken:undefined,userEmail:undefined}),
}),{
  name:"relocation-user-profile-v1",
  partialize:(state)=>({guestProfile:state.guestProfile,guestSavedProperties:state.guestSavedProperties,personalization:state.personalization,isDismissed:state.isDismissed,authToken:state.authToken,userEmail:state.userEmail}),
}));
