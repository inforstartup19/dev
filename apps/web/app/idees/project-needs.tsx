"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { privateJson } from "../../lib/private-api";
import styles from "./project-workspace.module.css";

type Need = {
  id: string;
  title: string;
  description: string;
  state: "draft" | "published" | "revoked";
  audience: "private" | "authenticated";
  version: number;
};
type Event = {
  id: string; action: "publish" | "revoke";
  version: number; reason: string;
};
const root = (draftId: string) => `idea-drafts/${draftId}/shared-needs`;

export function ProjectNeeds({ draftId, active }: { draftId: string; active: boolean }) {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [selected, setSelected] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const refresh = useCallback(async () => {
    setNeeds(await privateJson<Need[]>(root(draftId)));
  }, [draftId]);
  useEffect(() => {
    let mounted = true;
    privateJson<Need[]>(root(draftId))
      .then((items) => { if (mounted) setNeeds(items); })
      .catch((err) => { if (mounted) setError(String(err)); });
    return () => { mounted = false; };
  }, [draftId]);
  useEffect(() => {
    let mounted = true;
    if (!selected) return;
    privateJson<Event[]>(`${root(draftId)}/${selected}/events`)
      .then((items) => { if (mounted) setEvents(items); })
      .catch((err) => { if (mounted) setError(String(err)); });
    return () => { mounted = false; };
  }, [draftId, selected, needs]);

  async function run(task: () => Promise<void>, message: string) {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await task();
      await refresh();
      setInfo(message);
      setReason("");
      setAck(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha completat l'acció.");
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      const need = await privateJson<Need>(root(draftId), { title, description });
      setNeeds((items) => [need, ...items]);
      setSelected(need.id);
      setTitle("");
      setDescription("");
    }, "Necessitat creada en privat. No s'ha compartit.");
  }

  const item = needs.find((need) => need.id === selected);
  async function change(action: "publish" | "revoke") {
    if (!item || !ack || !reason.trim()) return;
    await run(async () => {
      await privateJson(`${root(draftId)}/${item.id}/${action}`, {
        expected_version: item.version, confirm: true, reason,
      });
    }, action === "publish"
      ? "Necessitat publicada per a comptes autenticats. El projecte continua privat."
      : "Necessitat revocada: ja no és consultable per tercers.");
  }

  return (
    <section className={styles.panel} aria-label="Necessitats compartibles" data-testid="project-needs">
      <h3>Necessitats · publicació selectiva</h3>
      <p>El projecte, les proves i les evidències continuen privats. Pots compartir només el text que autoritzis.</p>
      {error && <p role="alert">{error}</p>}
      {info && <p role="status">{info}</p>}
      <form className={styles.form} onSubmit={create}>
        <label>Títol de la necessitat
          <input required maxLength={120} value={title}
            onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>Text que podria veure un altre compte
          <textarea required maxLength={1200} value={description}
            onChange={(event) => setDescription(event.target.value)} />
        </label>
        <button type="submit" disabled={busy || !active}>Preparar necessitat privada</button>
      </form>
      <h3>Necessitats preparades</h3>
      {needs.length === 0 && <p>Encara no hi ha cap necessitat compartible.</p>}
      {needs.map((need) => (
        <button key={need.id} type="button"
          aria-pressed={selected === need.id} onClick={() => {
            setSelected(need.id); setAck(false); setReason(""); setEvents([]);
          }} className={selected === need.id ? styles.selected : styles.row}>
          {need.title} · {need.state === "draft" ? "Privada" :
            need.state === "published" ? "Publicada a comptes autenticats" : "Revocada"}
        </button>
      ))}
      {item && <div data-testid="need-preview">
        <h3>Vista prèvia exacta</h3>
        <p><strong>{item.title}</strong></p>
        <p>{item.description}</p>
        <p><strong>Audiència:</strong> {item.state === "published"
          ? "Comptes autenticats" : "Només el meu compte (fins a confirmar la publicació)"}</p>
        <p>No s'hi inclou cap dada de la fitxa mare, pressupost, resultat ni evidència.</p>
        {(item.state === "draft" || item.state === "published") && <>
          <label>Motiu de {item.state === "draft" ? "publicació" : "revocació"}
            <textarea maxLength={500} value={reason}
              onChange={(event) => setReason(event.target.value)} />
          </label>
          <label>
            <input type="checkbox" checked={ack}
              onChange={(event) => setAck(event.target.checked)} />
            Confirmo l'audiència i les conseqüències d'aquesta acció.
          </label>
          <button type="button" disabled={busy || !ack || !reason.trim() ||
            (item.state === "draft" && !active)}
            onClick={() => change(item.state === "draft" ? "publish" : "revoke")}>
            {item.state === "draft" ? "Publicar només aquesta necessitat" :
              "Revocar aquesta necessitat"}
          </button>
        </>}
        <h3>Historial de publicació</h3>
        <ol className={styles.history}>{events.map((e) =>
          <li key={e.id}>v{e.version} · {e.action === "publish" ? "Publicat" : "Revocat"} · {e.reason}</li>
        )}</ol>
      </div>}
    </section>
  );
}
