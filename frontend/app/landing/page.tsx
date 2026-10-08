import Link from "next/link";
import { ArrowRight, Github, MapPin, ShieldCheck, TrainFront, Wifi, Wallet, Sparkles, SlidersHorizontal, Layers3, Compass, House } from "lucide-react";
import type { Metadata } from "next";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Habita AI | Find where you belong",
  description: "Open-source AI relocation intelligence. Explore rentals with explainable scores for commute, affordability, safety and lifestyle.",
};

const features = [
  { icon: TrainFront, name: "Commute-aware discovery", desc: "Find homes with your daily journey in mind, not just their distance on a map." },
  { icon: Wallet, name: "Affordability intelligence", desc: "Balance rental budgets with your other priorities using transparent ranking." },
  { icon: ShieldCheck, name: "Safety and essentials", desc: "Compare locality signals including safety, nearby essentials and daily convenience." },
  { icon: Wifi, name: "Lifestyle fit", desc: "Factor in internet connectivity, amenities and preferences that make a place yours." },
  { icon: SlidersHorizontal, name: "Explainable recommendations", desc: "Understand why a home ranks highly with weighted, multi-factor scores." },
  { icon: MapPin, name: "Explore on a map", desc: "Discover properties and localities through interactive geographic context." }
];
const repo = "https://github.com/dedipya001/AI-Relocation-Assistant";
export default function LandingPage() {
  return <main className={styles.shell}>
    <header className={styles.nav}>
      <Link className={styles.brand} href="/landing"><span className={styles.brandIcon}><House size={20}/></span> Habita <span>AI</span></Link>
      <nav aria-label="Primary navigation" className={styles.links}><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#open-source">Open source</a></nav>
      <Link href="/" className={styles.navCta}>Launch app <ArrowRight size={15}/></Link>
    </header>
    <section className={styles.hero}>
      <div className={styles.pill}><Sparkles size={14}/> Open source · Early-stage AI platform</div>
      <h1>Your next home,<br/><em>more than a pin on a map.</em></h1>
      <p>Meet Habita AI, an intelligent way to find where life works. Compare homes and neighborhoods across commute, cost, safety, connectivity and lifestyle—without losing sight of what matters to you.</p>
      <div className={styles.actions}><Link href="/" className={styles.primary}>Explore the application <ArrowRight size={18}/></Link><a className={styles.secondary} href={repo} target="_blank" rel="noopener noreferrer"><Github size={18}/> View on GitHub</a></div>
      <div className={styles.cities}><MapPin size={16}/> Exploring Kolkata, Bengaluru, Mumbai & Pune</div>
      <div className={styles.preview}>
        <div className={styles.previewHeader}><span className={styles.dots}>● ● ●</span><span>Habita AI / Decision intelligence</span><span className={styles.live}>● EXPLAINABLE RANKING</span></div>
        <div className={styles.previewGrid}>
          <div className={styles.mapPanel}><span className={styles.mapLabel}><Compass size={16}/> Neighborhood discovery</span><div className={styles.rings}><span className={styles.pinOne}>⌂</span><span className={styles.pinTwo}>⌂</span><span className={styles.pinThree}>⌂</span></div><small>Illustrative interface · Not live listings</small></div>
          <div className={styles.insights}><span className={styles.miniLabel}>DECISION FACTORS</span>{[["Commute",86],["Affordability",78],["Safety",91],["Internet & essentials",82]].map(([name,score])=><div className={styles.factor} key={name}><div><span>{name}</span><b>{score}%</b></div><span className={styles.track}><span style={{width:`${score}%`}}/></span></div>)}<div className={styles.explain}><Sparkles size={16}/> Know why a place fits—not just that it does.</div></div>
        </div>
      </div>
    </section>
    <section id="features" className={styles.section}><div className={styles.kicker}>BUILT FOR BETTER DECISIONS</div><h2>Home is more than<br/>four walls.</h2><p className={styles.sectionIntro}>Search the whole picture, with useful signals that support your decision.</p><div className={styles.featureGrid}>{features.map(({icon:Icon,name,desc})=><article className={styles.feature} key={name}><span className={styles.featureIcon}><Icon size={23}/></span><h3>{name}</h3><p>{desc}</p></article>)}</div></section>
    <section id="how-it-works" className={styles.process}><div><div className={styles.kicker}>HOW IT WORKS</div><h2>Your priorities.<br/>Your place.</h2><p>Habita AI combines search, geospatial insights and deterministic scoring to support understandable relocation decisions.</p></div><div className={styles.steps}>{[["01","Tell us what matters","Start with a location, workplace, budget and personal preferences."],["02","Explore potential matches","Browse rental and locality information alongside interactive maps."],["03","Understand the tradeoffs","Compare weighted factors and see the reasoning behind rankings."]].map(([num,title,desc])=><div className={styles.step} key={num}><span>{num}</span><div><h3>{title}</h3><p>{desc}</p></div></div>)}</div></section>
    <section id="open-source" className={styles.oss}><Layers3 size={32}/><div className={styles.kicker}>OPEN SOURCE & BUILDING IN PUBLIC</div><h2>Intelligence for every move.</h2><p>Habita AI is an early-stage, open-source relocation intelligence project. Built with Next.js, TypeScript, Express, MongoDB and Redis; designed for an evolving hosted experience. Explore the code, contribute or follow the roadmap.</p><div className={styles.actions}><a className={styles.primary} href={repo} target="_blank" rel="noopener noreferrer"><Github size={18}/> Explore repository</a><a className={styles.secondary} href={repo+"/issues"} target="_blank" rel="noopener noreferrer">View roadmap <ArrowRight size={18}/></a></div></section>
    <footer className={styles.footer}><Link href="/landing" className={styles.brand}><span className={styles.brandIcon}><House size={17}/></span> Habita <span>AI</span></Link><span>Find where you belong. · Open source · Early stage</span><a href={repo} target="_blank" rel="noopener noreferrer" aria-label="Habita AI on GitHub"><Github size={20}/></a></footer>
  </main>;
}
