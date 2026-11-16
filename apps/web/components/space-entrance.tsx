"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SPACE_TRAVEL_MS, startSpaceRenderer } from "../lib/space-renderer";
import styles from "./space-entrance.module.css";

export function SpaceEntrance({ destination }: { destination: string }) {
  const router=useRouter(), canvas=useRef<HTMLCanvasElement>(null), orb=useRef<HTMLButtonElement>(null);
  const renderer=useRef<ReturnType<typeof startSpaceRenderer>>(null);
  const timer=useRef<ReturnType<typeof setTimeout> | null>(null), navigating=useRef(false);
  const [paused,setPaused]=useState(false), [reduced,setReduced]=useState(true), [fallback,setFallback]=useState(false), [travel,setTravel]=useState(false);
  function stop() { if(timer.current) clearTimeout(timer.current); timer.current=null; }
  function finish() { stop(); if(navigating.current) return; navigating.current=true; router.push(destination); }
  function cancel() { stop(); setTravel(false); renderer.current?.travel(false); orb.current?.focus(); }
  function enter() {
    if(navigating.current || timer.current) return;
    if(paused || reduced || fallback) { finish(); return; }
    setTravel(true); renderer.current?.travel(true); timer.current=setTimeout(finish,SPACE_TRAVEL_MS);
  }
  useEffect(()=>{
    const motion=matchMedia("(prefers-reduced-motion: reduce)");
    const update=()=>setReduced(motion.matches); update(); motion.addEventListener("change",update);
    renderer.current=startSpaceRenderer(canvas.current!,orb.current!); setFallback(!renderer.current);
    return ()=>{ stop(); renderer.current?.dispose(); renderer.current=null; motion.removeEventListener("change",update); };
  },[]);
  useEffect(()=>{ renderer.current?.pause(paused || reduced); if(paused || reduced) { stop(); setTravel(false); renderer.current?.travel(false); } },[paused,reduced]);
  return <main className={styles.scene} data-travelling={travel} onKeyDown={e=>{if(e.key==="Escape" && travel){e.preventDefault();cancel();}}}>
    <canvas ref={canvas} className={styles.canvas} aria-hidden="true"/>
    <header className={styles.top}><span className={styles.brand}>inc.</span><span>UN UNIVERS DE POSSIBILITATS</span><a href={destination} onClick={e=>{if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();finish();}}}>Entra directament ↗</a></header>
    <div className={styles.heading}><p>LES IDEES NO TENEN LÍMITS</p><h1>Tot comença amb<br/>una <em>connexió.</em></h1><p>Persones, coneixement i idees.<br/>Un espai per fer-los créixer.</p></div>
    <div className={styles.universe}><div className={styles.concepts} aria-hidden="true">{["IDEES", "CIÈNCIA", "ART I CULTURA", "PERSONES", "UNIVERSITATS", "TECNOLOGIA"].map(word=><span key={word}>{word}</span>)}</div>
      <button ref={orb} className={`${styles.orb} ${fallback?styles.fallback:""}`} aria-label="Entra a IncForStartUp amb un viatge entre estrelles" aria-disabled={travel} onClick={enter} onPointerEnter={()=>renderer.current?.hover(true)} onPointerLeave={()=>renderer.current?.hover(false)} onFocus={()=>renderer.current?.hover(true)} onBlur={()=>renderer.current?.hover(false)}><span>inc.</span><small>ENTRA AL TEU UNIVERS ↗</small></button>
    </div>
    <footer className={styles.bottom}><span>UNA IDEA POT CANVIAR-HO TOT.</span><button aria-pressed={paused || reduced} disabled={reduced || fallback} onClick={()=>setPaused(v=>!v)}>{reduced?"Moviment reduït":paused?"Activa el moviment":"Pausa el moviment"}</button>{travel&&<button onClick={cancel}>Cancel·la el viatge</button>}</footer>
    <p role="status" className={styles.status}>{travel?"Entrant al teu espai… Prem Esc per cancel·lar.":fallback?"Entrada disponible sense animació.":""}</p>
  </main>;
}
