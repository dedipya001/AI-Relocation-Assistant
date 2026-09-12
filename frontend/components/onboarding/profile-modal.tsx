"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { SUPPORTED_CITIES, useSearchStore, type SupportedCity } from "@/store/search-store";
import { useUserProfileStore } from "@/store/user-profile-store";
import type { AgeGroup, GuestProfile } from "@/types";
import styles from "./onboarding.module.css";

const AGE_GROUPS:AgeGroup[]=["18-24","25-32","33-45","46+"];
const PRIORITIES=["Metro","Women Safety","Power Backup","Work Cafes","Pet Friendly","Fast Internet"];

function emptyProfile(city:SupportedCity):GuestProfile {
  return {age_group:"25-32",gender:"prefer-not-to-say",profession:"Professional",target_budget:30000,preferred_city:city,priority_amenities:[]};
}

export function ProfileModal(){
  const open=useUserProfileStore((state)=>state.profileModalOpen);
  const setOpen=useUserProfileStore((state)=>state.setProfileModalOpen);
  const guestProfile=useUserProfileStore((state)=>state.guestProfile);
  const setGuestProfile=useUserProfileStore((state)=>state.setGuestProfile);
  const requestLogin=useUserProfileStore((state)=>state.requestLogin);
  const selectedCity=useSearchStore((state)=>state.selectedCity);
  const [form,setForm]=useState<GuestProfile>(()=>guestProfile??emptyProfile(selectedCity));
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string>();

  useEffect(()=>{if(open){setForm(guestProfile??emptyProfile(selectedCity));setError(undefined);}},[open,guestProfile,selectedCity]);

  function togglePriority(priority:string){
    setForm((current)=>({...current,priority_amenities:current.priority_amenities.includes(priority)?current.priority_amenities.filter((item)=>item!==priority):[...current.priority_amenities,priority]}));
  }

  async function save(sync:boolean){
    if(!form.profession.trim()||!form.gender.trim()||form.target_budget<=0){setError("Please add a valid profession, gender preference and budget.");return;}
    setSaving(true);setError(undefined);
    try{
      await setGuestProfile({...form,profession:form.profession.trim()});
      setOpen(false);
      if(sync)requestLogin("profile");
    }catch(err){setError(err instanceof Error?err.message:"Unable to personalize your feed.");}finally{setSaving(false);}
  }

  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Portal>
      <Dialog.Overlay className={styles.overlay}/>
      <Dialog.Content className={styles.dialog} aria-describedby="profile-description">
        <div className={styles.dialogHeader}>
          <div><Dialog.Title className={styles.dialogTitle}>Personalize your feed</Dialog.Title><Dialog.Description id="profile-description" className={styles.modalHint}>Tune recommendations now as a guest. Creating an account is optional.</Dialog.Description></div>
          <Dialog.Close className={styles.dialogClose} aria-label="Close"><X size={16}/></Dialog.Close>
        </div>
        <div className={styles.formGrid}>
          <div className={styles.field}><label htmlFor="profile-age">Age band</label><select id="profile-age" value={form.age_group} onChange={(event)=>setForm({...form,age_group:event.target.value as AgeGroup})}>{AGE_GROUPS.map((age)=><option key={age}>{age}</option>)}</select></div>
          <div className={styles.field}><label htmlFor="profile-gender">Gender</label><select id="profile-gender" value={form.gender} onChange={(event)=>setForm({...form,gender:event.target.value})}><option value="prefer-not-to-say">Prefer not to say</option><option value="woman">Woman</option><option value="man">Man</option><option value="non-binary">Non-binary</option><option value="other">Other</option></select></div>
          <div className={styles.field}><label htmlFor="profile-profession">Profession / role</label><input id="profile-profession" value={form.profession} onChange={(event)=>setForm({...form,profession:event.target.value})} placeholder="Software Engineer"/></div>
          <div className={styles.field}><label htmlFor="profile-budget">Target monthly rent</label><input id="profile-budget" type="number" min="1000" step="500" value={form.target_budget} onChange={(event)=>setForm({...form,target_budget:Number(event.target.value)})}/></div>
          <div className={styles.field}><label htmlFor="profile-city">City</label><select id="profile-city" value={form.preferred_city} onChange={(event)=>setForm({...form,preferred_city:event.target.value})}>{SUPPORTED_CITIES.map((city)=><option key={city}>{city}</option>)}</select></div>
          <div className={`${styles.field} ${styles.fieldFull}`}><label>Top priorities</label><div className={styles.priorityGrid}>{PRIORITIES.map((priority)=><button key={priority} type="button" className={`${styles.pill} ${form.priority_amenities.includes(priority)?styles.pillActive:""}`} onClick={()=>togglePriority(priority)}>{priority}</button>)}</div></div>
        </div>
        {error&&<p className={styles.error}>{error}</p>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.primaryAction} disabled={saving} onClick={()=>void save(false)}>{saving?"Tailoring…":"Show my tailored feed"}</button>
          <button type="button" className={styles.secondaryAction} disabled={saving} onClick={()=>void save(true)}>Save profile & sync devices</button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
