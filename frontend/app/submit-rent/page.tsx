"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { Nav } from "@/components/nav";
import { api } from "@/lib/api";
import styles from "./page.module.css";

type Form = {
  propertyId:string; localityId:string; listedRent:string; negotiatedRent:string; depositMonths:string; deductions:string; brokerage:string; maintenance:string; backup:string; isp:string; speed:string; safety:string; noise:string; waterlogging:string; womenSafety:string; lateNight:string; website:string;
};
const initial:Form={propertyId:"",localityId:"",listedRent:"",negotiatedRent:"",depositMonths:"",deductions:"",brokerage:"",maintenance:"",backup:"",isp:"",speed:"",safety:"70",noise:"70",waterlogging:"70",womenSafety:"70",lateNight:"65",website:""};
const n=(value:string)=>value.trim()===""?undefined:Number(value);

export default function SubmitRentPage(){
  const[step,setStep]=useState(1);const[form,setForm]=useState<Form>(initial);const[status,setStatus]=useState<"idle"|"saving"|"done"|"error">("idle");const[error,setError]=useState("");
  useEffect(()=>{const p=new URLSearchParams(window.location.search);setForm((f)=>({...f,propertyId:p.get("propertyId")??f.propertyId,localityId:p.get("localityId")??f.localityId,listedRent:p.get("listedRent")??f.listedRent}));},[]);
  const set=(key:keyof Form)=>(event:{target:{value:string}})=>setForm((f)=>({...f,[key]:event.target.value}));
  const submit=async(event:FormEvent)=>{event.preventDefault();setStatus("saving");setError("");try{
    if(!form.localityId||!form.listedRent||!form.negotiatedRent)throw new Error("Locality, listed rent and final rent are required.");
    await api.submitNegotiatedRent({property_id:form.propertyId||undefined,locality_id:form.localityId,listed_rent:Number(form.listedRent),negotiated_rent:Number(form.negotiatedRent),security_deposit_months:n(form.depositMonths),move_out_deductions:n(form.deductions),broker_commission:n(form.brokerage),maintenance_charges:n(form.maintenance),water_power_backup_charges:n(form.backup),wifi_isp:form.isp||undefined,wifi_speed_mbps:n(form.speed),_website:form.website});
    await api.submitLocalityFeedback({locality_id:form.localityId,category:"community",score:n(form.safety)??70,safety_score:n(form.safety),noise_score:n(form.noise),waterlogging_score:n(form.waterlogging),women_safety_score:n(form.womenSafety),late_night_score:n(form.lateNight),internet_score:form.speed?Math.min(100,Math.round(Number(form.speed)/5)):undefined,_website:form.website});
    setStatus("done");
  }catch(e){setError(e instanceof Error?e.message:"Unable to submit feedback");setStatus("error");}};
  if(status==="done")return <><Nav/><main className={styles.main}><div className={styles.success}><CheckCircle2 size={34}/><h1>Thanks for sharing the real deal</h1><p>Your anonymous report is pending verification. Approved reports improve locality scores and negotiation benchmarks.</p><Link href="/search">Back to homes</Link></div></main></>;
  return <><Nav/><main className={styles.main}><Link className={styles.back} href="/search"><ArrowLeft size={14}/> Back to search</Link><div className={styles.hero}><div><p className={styles.eyebrow}>Anonymous community report</p><h1>What did the home really cost?</h1><p>Help other renters see negotiated rent, deposits, hidden charges and neighbourhood reality.</p></div><div className={styles.privacy}><ShieldCheck size={18}/><span>No name, phone or email required.</span></div></div>
    <div className={styles.steps}>{["Rent & deposit","Monthly reality","Local signals"].map((label,i)=><div key={label} className={step>=i+1?styles.activeStep:""}><b>{i+1}</b><span>{label}</span></div>)}</div>
    <form className={styles.card} onSubmit={submit}><input aria-hidden="true" tabIndex={-1} autoComplete="off" className={styles.honeypot} value={form.website} onChange={set("website")}/>
      {step===1&&<div className={styles.grid}><label>Locality ID<input required value={form.localityId} onChange={set("localityId")} placeholder="loc-sector-v"/></label><label>Property ID <small>optional</small><input value={form.propertyId} onChange={set("propertyId")}/></label><label>Listed asking rent ₹<input required type="number" min="1" value={form.listedRent} onChange={set("listedRent")}/></label><label>Final negotiated rent ₹<input required type="number" min="1" value={form.negotiatedRent} onChange={set("negotiatedRent")}/></label><label>Security deposit (months)<input type="number" min="0" max="24" value={form.depositMonths} onChange={set("depositMonths")}/></label><label>Move-out deductions ₹<input type="number" min="0" value={form.deductions} onChange={set("deductions")}/></label></div>}
      {step===2&&<div className={styles.grid}><label>Brokerage paid ₹<input type="number" min="0" value={form.brokerage} onChange={set("brokerage")}/></label><label>Maintenance / month ₹<input type="number" min="0" value={form.maintenance} onChange={set("maintenance")}/></label><label>Water / backup charges ₹<input type="number" min="0" value={form.backup} onChange={set("backup")}/></label><label>Wi-Fi ISP<input value={form.isp} onChange={set("isp")} placeholder="Airtel / Jio / Alliance…"/></label><label>Measured speed Mbps<input type="number" min="0" max="10000" value={form.speed} onChange={set("speed")}/></label></div>}
      {step===3&&<div className={styles.ratings}>{[["safety","Overall safety"],["womenSafety","Women safety"],["lateNight","Late-night comfort"],["noise","Quietness"],["waterlogging","Water-logging resilience"]].map(([key,label])=><label key={key}>{label}<div><input type="range" min="0" max="100" value={form[key as keyof Form]} onChange={set(key as keyof Form)}/><b>{form[key as keyof Form]}/100</b></div></label>)}</div>}
      {error&&<p className={styles.error}>{error}</p>}<div className={styles.footer}>{step>1?<button type="button" className={styles.secondary} onClick={()=>setStep((s)=>s-1)}>Back</button>:<span/>}{step<3?<button type="button" onClick={()=>setStep((s)=>s+1)}>Continue <ArrowRight size={14}/></button>:<button disabled={status==="saving"} type="submit">{status==="saving"?"Submitting…":"Submit anonymously"}</button>}</div>
    </form></main></>;
}
