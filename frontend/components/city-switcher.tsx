"use client";

import { MapPin } from "lucide-react";
import { useSearchStore, type SupportedCity } from "@/store/search-store";
import styles from "./city-switcher.module.css";

const CITIES:SupportedCity[]=["Kolkata","Bengaluru","Pune","Hyderabad"];

export function CitySwitcher({ compact=false }:{compact?:boolean}){
  const selectedCity=useSearchStore((state)=>state.selectedCity);const setCity=useSearchStore((state)=>state.setCity);
  return <label className={`${styles.control} ${compact?styles.compact:""}`}><MapPin size={13}/><span className={styles.label}>City</span><select aria-label="Relocation city" value={selectedCity} onChange={(event)=>void setCity(event.target.value as SupportedCity)}>{CITIES.map((city)=><option key={city} value={city}>{city}</option>)}</select></label>;
}
