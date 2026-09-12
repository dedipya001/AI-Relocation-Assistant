"use client";

import { useState } from "react";
import { Settings2, X } from "lucide-react";
import { useUserProfileStore, type QuickRole } from "@/store/user-profile-store";
import { ProfileModal } from "./profile-modal";
import styles from "./onboarding.module.css";

const ROLES:Array<{id:QuickRole;label:string;profession:string}>=[
  {id:"student",label:"🎓 Student / Intern",profession:"Student / Intern"},
  {id:"tech",label:"💻 Tech Pro",profession:"Software Engineer"},
  {id:"family",label:"👨‍👩‍👧 Family",profession:"Family"},
  {id:"executive",label:"👔 Executive",profession:"Executive"},
];
const PRIORITIES=["🚇 Metro","🛡️ Women Safety","⚡ Power Backup","☕ Work Cafes","🐾 Pet Friendly"];

function roleActive(profession:string|undefined,role:QuickRole){
  const value=(profession||"").toLowerCase();
  if(role==="student")return /student|intern/.test(value);
  if(role==="tech")return /software|engineer|tech|developer|data|product/.test(value);
  if(role==="family")return /family|parent|homemaker/.test(value);
  return /executive|manager|director|founder/.test(value);
}

function priorityValue(label:string){return label.replace(/^\S+\s*/,"");}

export function QuickTailorBar(){
  const guestProfile=useUserProfileStore((state)=>state.guestProfile);
  const personalization=useUserProfileStore((state)=>state.personalization);
  const isDismissed=useUserProfileStore((state)=>state.isDismissed);
  const selectRole=useUserProfileStore((state)=>state.selectRole);
  const togglePriority=useUserProfileStore((state)=>state.togglePriority);
  const dismissTailor=useUserProfileStore((state)=>state.dismissTailor);
  const setProfileModalOpen=useUserProfileStore((state)=>state.setProfileModalOpen);
  const [busy,setBusy]=useState<string>();

  async function run(key:string,fn:()=>Promise<void>){
    setBusy(key);
    try{await fn();}finally{setBusy(undefined);}
  }

  if(isDismissed){
    return <>
      <div className={styles.compactTailored}>
        <div>
          <strong>{guestProfile?"Your feed is tailored":"Want more relevant matches?"}</strong>
          <span>{guestProfile?`${personalization?.scoring_profile.replaceAll("_"," ")||guestProfile.profession} · ₹${guestProfile.target_budget.toLocaleString("en-IN")} budget`:"Add your role, budget and priorities without creating an account."}</span>
        </div>
        <button type="button" className={styles.linkButton} onClick={()=>setProfileModalOpen(true)}>{guestProfile?"Edit":"Personalize"}</button>
      </div>
      <ProfileModal />
    </>;
  }

  return <>
    <div className={styles.tailor} aria-label="Quick feed personalization">
      <div className={styles.tailorHead}>
        <div><p className={styles.tailorTitle}>10-second tailor</p><p className={styles.tailorHint}>Pick what sounds like you. Results re-rank immediately; no signup required.</p></div>
        <button type="button" className={styles.closeButton} onClick={dismissTailor} aria-label="Dismiss personalization"><X size={15}/></button>
      </div>
      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Role</span>
          <div className={styles.pills}>{ROLES.map((role)=><button key={role.id} type="button" disabled={Boolean(busy)} className={`${styles.pill} ${roleActive(guestProfile?.profession,role.id)?styles.pillActive:""}`} onClick={()=>void run(`role-${role.id}`,()=>selectRole(role.id))}>{busy===`role-${role.id}`?"Updating…":role.label}</button>)}</div>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Priorities</span>
          <div className={styles.pills}>{PRIORITIES.map((label)=>{const value=priorityValue(label);const active=guestProfile?.priority_amenities.includes(value);return <button key={label} type="button" disabled={Boolean(busy)} className={`${styles.pill} ${active?styles.pillActive:""}`} onClick={()=>void run(`priority-${value}`,()=>togglePriority(value))}>{busy===`priority-${value}`?"Updating…":label}</button>;})}</div>
        </div>
      </div>
      <div className={styles.tailorActions}>
        <span className={styles.status}>{guestProfile?`Tailored for ${guestProfile.profession} in ${guestProfile.preferred_city}`:"You can keep browsing without answering anything."}</span>
        <button type="button" className={styles.linkButton} onClick={()=>setProfileModalOpen(true)}><Settings2 size={13}/> Personalize my feed</button>
      </div>
    </div>
    <ProfileModal />
  </>;
}
