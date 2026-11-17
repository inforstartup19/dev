"use client";
import { useState } from "react";
import Link from "next/link";
import { suggestedStartupTrack } from "../../lib/startup-pathways";
export function StartupOrientation() {
  const [recommendation, setRecommendation] = useState<string | null>(null);
  return <section className="su-orientation"><div><span className="su-eyebrow">EL TEU PUNT DE PARTIDA</span><h2>No cal començar de zero.</h2><p>Revisa la teva maduresa i explora el recorregut que millor encaixa amb el moment del projecte.</p></div>
    <form onSubmit={(event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      setRecommendation(suggestedStartupTrack(values.has("need"), values.has("mvp"), values.has("evidence")));
    }}>
      <label><input type="checkbox" name="need" />He contrastat una necessitat amb el públic</label>
      <label><input type="checkbox" name="mvp" />Tinc un MVP o una primera versió provada</label>
      <label><input type="checkbox" name="evidence" />Puc aportar evidències d’ús o resultats</label>
      <button className="su-primary">Orienta el meu recorregut</button>
    </form>
    <div id="su-recommendation" role="status">{recommendation && <><p><strong>{recommendation === "enlaira" ? "Enlaira" : "Crea i creix"}</strong> · {recommendation === "enlaira" ? "Has indicat necessitat contrastada, MVP i evidències. Pots preparar una proposta per a la revisió inicial." : "Encara hi ha hipòtesis inicials per contrastar. Comença preparant una primera prova."} La proposta és orientativa; no és una admissió. Pots explorar els dos itineraris. Les respostes no es desen.</p><Link href={`/startup?track=${recommendation}`}>Explora aquest itinerari</Link></>}</div>
  </section>;
}
