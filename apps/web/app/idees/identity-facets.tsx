"use client";

import { useEffect, useState, type FormEvent } from "react";
import { privateJson } from "../../lib/private-api";
import styles from "./short-card.module.css";

type Kind = "creator" | "student" | "mentor" | "professional";
type Facet = { id: string; kind: Kind; summary: string; audience: "private" };
const labels: Record<Kind, string> = {
  creator: "Creador/a", student: "Estudiant", mentor: "Mentor/a",
  professional: "Professional",
};
export function IdentityFacets() {
  const [facets, setFacets] = useState<Facet[]>([]);
  const [kind, setKind] = useState<Kind>("creator");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    privateJson<Facet[]>("me/facets")
      .then((items) => { if (active) setFacets(items); })
      .catch((err) => { if (active) setMessage(String(err)); });
    return () => { active = false; };
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const item = await privateJson<Facet>("me/facets", { kind, summary });
      setFacets((items) => [...items.filter((f) => f.kind !== kind), item]);
      setMessage("Faceta desada en privat; no concedeix accés a cap projecte.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error en desar la faceta.");
    } finally { setBusy(false); }
  }
  return <section className={styles.card} aria-label="Facetes del meu compte" data-testid="identity-facets">
    <h2>Un compte, diferents facetes</h2>
    <p>La faceta només descriu com participes a Inc. No canvia rols Campus ni permisos de projectes.</p>
    <form onSubmit={save}>
      <label>Faceta
        <select value={kind} onChange={(event) => {
          const next = event.target.value as Kind; setKind(next);
          setSummary(facets.find((item) => item.kind === next)?.summary ?? "");
        }}>
          {Object.entries(labels).map(([value, label]) =>
            <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Presentació privada
        <textarea maxLength={500} value={summary}
          onChange={(event) => setSummary(event.target.value)} />
      </label>
      <button type="submit" disabled={busy}>Desar faceta privada</button>
    </form>
    {message && <p role="status">{message}</p>}
    <ul>{facets.map((facet) =>
      <li key={facet.id}>{labels[facet.kind]} · privada · {facet.summary}</li>)}</ul>
  </section>;
}
