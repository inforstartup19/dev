"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { geometry } from "../lib/quelcom-geometry.js";
import styles from "./quelcom-universe.module.css";
const spaces = [
  { title: "Campus", href: "/campus", description: "Universitats, persones i coneixement", style: "campus" },
  { title: "Idea", href: "/idees", description: "Dona espai a una intuïció", style: "idea" },
  { title: "Projecte", href: "/projectes", description: "Reprèn el teu Projecte Viu", style: "project" },
  { title: "Startup", href: "/startup", description: "Prepara el següent horitzó", style: "startup" },
];
export function QuelcomUniverse() {
  const scene = useRef<HTMLElement>(null);
  useEffect(() => {
    const nodes = [...scene.current!.querySelectorAll<SVGGElement>("[data-mesh]")];
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, last = 0;
    const phases = nodes.map((_, i) => i * .9);
    function tick(now: number) {
      if (document.hidden || reduced.matches) return;
      frame = requestAnimationFrame(tick);
      if (now - last < 66) return;
      const dt = Math.min((now - last) / 1000, .1); last = now;
      nodes.forEach((node, i) => {
        const engaged = node.closest("a")!.matches(":hover,:focus-visible") ? 1 : 0;
        phases[i] += dt * (.3 + engaged * .9);
        geometry(phases[i], "satellite", engaged).forEach((path, j) => {
          node.children[j].setAttribute("d", path.d);
          node.children[j].setAttribute("stroke-opacity", String(path.opacity));
        });
      });
    }
    function resume() { cancelAnimationFrame(frame); last = 0; if (!document.hidden && !reduced.matches) frame = requestAnimationFrame(tick); }
    resume(); document.addEventListener("visibilitychange", resume); reduced.addEventListener("change", resume);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", resume); reduced.removeEventListener("change", resume); };
  }, []);
  return <main ref={scene} className={styles.scene}>
    <h1 className="quelcom-sr">Tria el teu espai a Quelcom</h1>
    <div className={styles.stars} aria-hidden="true">{Array.from({ length: 160 }, (_, i) => <i key={i} style={{ left: `${(i * 61.803) % 100}%`, top: `${(i * 37.131) % 100}%`, opacity: .15 + (i % 6) * .09 }} />)}</div>
    <nav className={styles.destinations} aria-label="Tria el teu espai">
      {spaces.map((space, i) => <Link key={space.title} href={space.href} prefetch={false} className={`${styles.destination} ${styles[space.style]}`} aria-label={`${space.title}: ${space.description}`}>
        <span className={styles.orb}><svg viewBox="-125 -125 250 250" aria-hidden="true" focusable="false">
          <circle r="99" fill="none" stroke="currentColor" strokeOpacity=".5" />
          <g data-mesh={i}>{geometry(i * .9, "satellite", 0).map((p, j) => <path key={j} d={p.d} fill="none" stroke={p.color} strokeOpacity={p.opacity} strokeWidth=".65" />)}</g>
        </svg><strong>{space.title}</strong></span>
      </Link>)}
    </nav>
  </main>;
}
