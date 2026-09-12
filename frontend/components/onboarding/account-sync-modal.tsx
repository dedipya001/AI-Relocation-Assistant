"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { useUserProfileStore } from "@/store/user-profile-store";
import styles from "./onboarding.module.css";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize:(input:{client_id:string;callback:(response:{credential:string})=>void})=>void;
          renderButton:(element:HTMLElement,input:Record<string,unknown>)=>void;
        };
      };
    };
  }
}

const REASON_COPY={
  shortlist:"Save your shortlist & preferences across all your devices.",
  price_alert:"Keep your price-drop alerts and saved homes available on every device.",
  sync:"Sync your local shortlist and personalized feed to your account.",
  profile:"Save this tailored profile so it follows you across devices.",
} as const;

function ensureGoogleScript(){
  return new Promise<void>((resolve,reject)=>{
    if(window.google?.accounts?.id){resolve();return;}
    const existing=document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if(existing){existing.addEventListener("load",()=>resolve(),{once:true});existing.addEventListener("error",()=>reject(new Error("Google sign-in failed to load.")),{once:true});return;}
    const script=document.createElement("script");script.src="https://accounts.google.com/gsi/client";script.async=true;script.defer=true;script.onload=()=>resolve();script.onerror=()=>reject(new Error("Google sign-in failed to load."));document.head.appendChild(script);
  });
}

export function AccountSyncModal(){
  const open=useUserProfileStore((state)=>state.loginModalOpen);
  const closeLogin=useUserProfileStore((state)=>state.closeLogin);
  const reason=useUserProfileStore((state)=>state.loginGateReason)??"sync";
  const signupWithEmail=useUserProfileStore((state)=>state.signupWithEmail);
  const loginWithEmail=useUserProfileStore((state)=>state.loginWithEmail);
  const loginWithGoogleCredential=useUserProfileStore((state)=>state.loginWithGoogleCredential);
  const authLoading=useUserProfileStore((state)=>state.authLoading);
  const authError=useUserProfileStore((state)=>state.authError);
  const guestSavedProperties=useUserProfileStore((state)=>state.guestSavedProperties);
  const [mode,setMode]=useState<"signup"|"login">("signup");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [googleError,setGoogleError]=useState<string>();
  const googleRef=useRef<HTMLDivElement>(null);
  const googleClientId=process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(()=>{
    if(!open||!googleClientId||!googleRef.current)return;
    let active=true;
    void ensureGoogleScript().then(()=>{
      if(!active||!window.google?.accounts?.id||!googleRef.current)return;
      googleRef.current.innerHTML="";
      window.google.accounts.id.initialize({client_id:googleClientId,callback:(response)=>{void loginWithGoogleCredential(response.credential);}});
      window.google.accounts.id.renderButton(googleRef.current,{theme:"outline",size:"large",width:320,text:"continue_with"});
    }).catch((error)=>setGoogleError(error instanceof Error?error.message:"Google sign-in is unavailable."));
    return()=>{active=false;};
  },[open,googleClientId,loginWithGoogleCredential]);

  useEffect(()=>{if(open){setPassword("");setGoogleError(undefined);}},[open]);

  async function submit(){
    if(!email.trim()||password.length<8)return;
    if(mode==="signup")await signupWithEmail(email.trim(),password);else await loginWithEmail(email.trim(),password);
  }

  return <Dialog.Root open={open} onOpenChange={(next)=>{if(!next)closeLogin();}}>
    <Dialog.Portal>
      <Dialog.Overlay className={styles.overlay}/>
      <Dialog.Content className={`${styles.dialog} ${styles.dialogNarrow}`} aria-describedby="sync-description">
        <div className={styles.dialogHeader}>
          <div><Dialog.Title className={styles.dialogTitle}>Keep your relocation work synced</Dialog.Title><Dialog.Description id="sync-description" className={styles.syncHint}>{REASON_COPY[reason]}</Dialog.Description></div>
          <Dialog.Close className={styles.dialogClose} aria-label="Close"><X size={16}/></Dialog.Close>
        </div>
        <ul className={styles.syncBenefits}>
          <li><Check size={14}/> Your guest profile transfers automatically.</li>
          <li><Check size={14}/> {guestSavedProperties.length?`${guestSavedProperties.length} locally saved home${guestSavedProperties.length===1?"":"s"} will be migrated.`:"Future saved homes can sync across devices."}</li>
          <li><Check size={14}/> You can keep browsing as a guest if you prefer.</li>
        </ul>

        {googleClientId?<div ref={googleRef} className={styles.googleBox}/>:<p className={styles.status}>Google sign-in becomes available when NEXT_PUBLIC_GOOGLE_CLIENT_ID is configured. Email works now.</p>}
        {googleError&&<p className={styles.error}>{googleError}</p>}
        <div className={styles.divider}>or continue with email</div>

        <div className={styles.tabs}><button type="button" className={`${styles.tab} ${mode==="signup"?styles.tabActive:""}`} onClick={()=>setMode("signup")}>Create account</button><button type="button" className={`${styles.tab} ${mode==="login"?styles.tabActive:""}`} onClick={()=>setMode("login")}>Sign in</button></div>
        <div className={styles.authForm}>
          <div className={styles.field}><label htmlFor="sync-email">Email</label><input id="sync-email" type="email" autoComplete="email" value={email} onChange={(event)=>setEmail(event.target.value)} placeholder="you@example.com"/></div>
          <div className={styles.field}><label htmlFor="sync-password">Password</label><input id="sync-password" type="password" autoComplete={mode==="signup"?"new-password":"current-password"} value={password} onChange={(event)=>setPassword(event.target.value)} placeholder="At least 8 characters"/></div>
          {authError&&<p className={styles.error}>{authError}</p>}
          <button type="button" className={styles.primaryAction} disabled={authLoading||!email.trim()||password.length<8} onClick={()=>void submit()}>{authLoading?"Syncing…":mode==="signup"?"Create account & sync":"Sign in & sync"}</button>
          <button type="button" className={styles.secondaryAction} onClick={closeLogin}>Not now — keep browsing</button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
