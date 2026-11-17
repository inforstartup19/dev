"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { startQuelcom, words } from "../lib/quelcom-renderer.js";
import "./quelcom-entry.css";

export function SpaceEntrance({ destination }: { destination: string }) {
  const scene = useRef<HTMLElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!scene.current) return;
    let leaving = false;
    return startQuelcom(scene.current, () => {
      if (leaving) return;
      leaving = true;
      router.push(destination);
    });
  }, [destination, router]);
  return <main ref={scene} className="quelcom-entry space-scene" aria-label="Entrada a IncForStartUp">
    <canvas id="space-canvas" aria-hidden="true" />
    <div className="space-concepts" aria-hidden="true">{words.map(word => <span className="concept" key={word}>{word}</span>)}</div>
    <button id="space-orb" aria-label="Entra a IncForStartUp amb un viatge entre estrelles"><span className="orb-label">quelcom</span></button>
    <div className="space-bottom">UNA IDEA POT CANVIAR-HO TOT</div>
    <p id="space-status" className="quelcom-sr" role="status" />
  </main>;
}
