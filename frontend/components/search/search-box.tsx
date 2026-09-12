"use client";

import { FormEvent } from "react";
import { Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CitySwitcher } from "@/components/city-switcher";
import { useSearchStore } from "@/store/search-store";
import styles from "./search-box.module.css";

const suggestedPrompts=["Office in the main tech hub, commute under 20 mins and rent under 35k.","I want a calmer neighborhood with good cafes and metro access.","Show furnished 1BHK/2BHK options with reliable internet and lower evening traffic."];
export function SearchBox({compact=false}:{compact?:boolean}){const{query,setQuery,runSearch,isLoading}=useSearchStore();function onSubmit(event:FormEvent){event.preventDefault();void runSearch();}
  if(compact)return <form onSubmit={onSubmit} className={styles.compactForm}><CitySwitcher compact/><Textarea value={query} onChange={(e)=>setQuery(e.target.value)} aria-label="AI relocation prompt" placeholder="Office location · rent budget · commute · lifestyle…" className={styles.compactTextarea} onKeyDown={(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void runSearch();}}}/><Button type="submit" disabled={isLoading} className={styles.compactBtn}>{isLoading?<Search size={16} className={styles.spin}/>:<Sparkles size={16}/>}<span>{isLoading?"Searching…":"Search"}</span></Button></form>;
  return <form onSubmit={onSubmit} className={styles.form}><div className={styles.header}><div><p className={styles.label}>Tell the relocation AI what kind of life you want.</p><p className={styles.hint}>Include office, commute comfort, budget, and lifestyle vibe.</p></div><CitySwitcher/></div><Textarea value={query} onChange={(event)=>setQuery(event.target.value)} aria-label="AI relocation prompt" className={styles.textarea}/><div className={styles.promptChips}>{suggestedPrompts.map((prompt)=><button key={prompt} type="button" className={styles.chip} onClick={()=>setQuery(prompt)}>{prompt}</button>)}</div><div className={styles.actions}><Button type="submit" disabled={isLoading}><Sparkles size={17}/>{isLoading?"Mapping your relocation":"Start AI relocation search"}</Button><Button type="button" variant="secondary" onClick={()=>void runSearch(query)}><Search size={17}/>Refresh recommendations</Button></div></form>;
}
