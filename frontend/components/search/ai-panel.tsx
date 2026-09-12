"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, MapPin, Clock, ArrowRight } from "lucide-react";
import { SearchBox } from "@/components/search/search-box";
import { PersonaSelector } from "@/components/search/persona-selector";
import { PropertyCard } from "@/components/property/property-card";
import { ComparisonTray } from "@/components/property/comparison-tray";
import { useCompareStore } from "@/store/compare-store";
import { useSearchStore } from "@/store/search-store";
import type { Property, Recommendation } from "@/types";
import styles from "./ai-panel.module.css";

interface AIPanelProps { properties: Property[]; activeIndex: number; onSelect: (index: number) => void; }

export function AIPanel({ properties, activeIndex, onSelect }: AIPanelProps) {
  const { isLoading, response, selectedProfile } = useSearchStore();
  const { propertyIds, toggle } = useCompareStore();
  const activeItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => { activeItemRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [activeIndex]);

  const officeLabel = response?.intent?.filters?.office_location;
  const recommendations: Recommendation[] = response?.recommendations ?? [];
  const recommendationsById = new Map<string, Recommendation>(recommendations.map((r) => [r.entity_id, r]));
  const hasResults = properties.length > 0 && !isLoading;

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.brand}><div className={styles.brandMark}><Sparkles size={13} /></div><span className={styles.brandText}>Relocation AI</span></div>
        <SearchBox compact />
      </div>
      <PersonaSelector />
      <AnimatePresence mode="wait">
        {isLoading && <motion.div key="loading" className={styles.contextBar} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><LoadingState /></motion.div>}
        {hasResults && (
          <motion.div key="summary" className={styles.contextBar} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .38 }}>
            <AISummary count={properties.length} officeLabel={officeLabel} topProperty={properties[0]} topRecommendation={recommendations[0]} profile={selectedProfile} />
          </motion.div>
        )}
      </AnimatePresence>
      {hasResults && <ComparisonTray properties={properties} />}
      <div className={styles.list} role="list">
        {hasResults ? properties.map((property, index) => {
          const rec = recommendationsById.get(property._id) ?? recommendations[index];
          return (
            <motion.div key={property._id} role="listitem" ref={index === activeIndex ? activeItemRef : undefined} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(index * .042, .55), duration: .3 }}>
              <PropertyCard
                property={property}
                recommendation={rec}
                index={index}
                isActive={index === activeIndex}
                isCompared={propertyIds.includes(property._id)}
                onClick={() => onSelect(index)}
                onCompareToggle={() => toggle(property._id)}
              />
            </motion.div>
          );
        }) : !isLoading && <EmptyState />}
      </div>
    </aside>
  );
}

const THINKING_STAGES = ["Locating your office…","Analyzing commute patterns…","Computing multi-factor safety & internet scores…","Applying persona weights & constraints…","Curating explainable recommendations…"];
const STAGE_DELAYS = [0,600,1300,2100,3000];
function LoadingState() {
  const [stageIdx,setStageIdx] = useState(0);
  useEffect(() => { setStageIdx(0); const timers=STAGE_DELAYS.slice(1).map((delay,i)=>setTimeout(()=>setStageIdx(i+1),delay)); return()=>timers.forEach(clearTimeout); },[]);
  return <div className={styles.loading}><div className={styles.loadingRow}>{[0,1,2].map((i)=><motion.span key={i} className={styles.dot} animate={{opacity:[.25,1,.25],scale:[.7,1,.7]}} transition={{duration:1.1,delay:i*.18,repeat:Infinity}} />)}<AnimatePresence mode="wait"><motion.span key={stageIdx} className={styles.loadingText} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}}>{THINKING_STAGES[stageIdx]}</motion.span></AnimatePresence></div><div className={styles.shimmerStack}>{[100,78,90].map((w,i)=><div key={i} className={styles.shimmerBar} style={{width:`${w}%`}} />)}</div></div>;
}

function AISummary({count,officeLabel,topProperty,topRecommendation,profile}:{count:number;officeLabel?:string;topProperty?:Property;topRecommendation?:Recommendation;profile?:string}) {
  const commute=topProperty?.commute_estimate_minutes; const dist=topProperty?.distance_to_office_km; const score=topRecommendation?.score?.total; const profileLabel=profile?.replace("_"," ").toUpperCase()||"BALANCED";
  return <div className={styles.summary}><p className={styles.summaryTitle}><Sparkles size={12} className={styles.summaryIcon}/>{count} homes ranked under {profileLabel} persona</p><p className={styles.summaryBody}>{topProperty?.locality ? <>Top match: <strong>{topProperty.title}</strong> in <strong>{topProperty.locality}</strong>{score!=null&&<> · <span className={styles.scoreHighlight}>★ {score}/100</span></>}{commute!=null&&<> · <Clock size={11} className={styles.inlineIcon}/> {commute}&thinsp;min</>}{dist!=null&&<> · <MapPin size={11} className={styles.inlineIcon}/> {dist.toFixed(1)}&thinsp;km</>}</> : `Results ranked by multi-factor score near ${officeLabel??"your destination"}.`}</p></div>;
}

function EmptyState() {
  return <div className={styles.empty}><div className={styles.emptyOrb}><MapPin size={20}/></div><p className={styles.emptyTitle}>Describe where you want to live</p><p className={styles.emptyDesc}>Tell the AI your office location, commute limit, budget, and the lifestyle that matters to you.</p><div className={styles.emptyHint}><ArrowRight size={12}/><em>&ldquo;Office at Sector V · rent ≤ ₹20k · good cafés · quiet evenings&rdquo;</em></div></div>;
}
