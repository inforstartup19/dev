"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
export function EntranceFocus() {
  const path=usePathname(), previous=useRef(path);
  useEffect(()=>{
    const arriving=(previous.current==="/entrada" || previous.current==="/" || previous.current==="/univers") && previous.current!==path;
    previous.current=path;
    if(!arriving) return;
    let observer: MutationObserver | undefined;
    const focus=()=>{const heading=document.querySelector<HTMLElement>("main h1");if(!heading)return false;heading.tabIndex=-1;heading.focus({preventScroll:true});return true;};
    if(!focus()){observer=new MutationObserver(()=>{if(focus())observer?.disconnect();});observer.observe(document.body,{childList:true,subtree:true});}
    return ()=>observer?.disconnect();
  },[path]);
  return null;
}
