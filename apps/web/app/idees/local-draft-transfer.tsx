"use client";
import { useState, useRef } from "react";
import { IDEA_STORAGE_KEY, type IdeaDraft } from "../../lib/idea-drafts";
import { previewLocalDrafts, localDraftPayload } from "../../lib/local-draft-transfer";
import { privateJson } from "../../lib/private-api";

export function LocalDraftTransfer({ account, onImported }: { account: string; onImported: () => Promise<void> }) {
  const [drafts, setDrafts] = useState<IdeaDraft[]>([]), [selected, setSelected] = useState("");
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  const pending = useRef(false);
  function preview(raw: string) {
    setError(""); setMessage(""); setConfirmed(false); setDrafts([]); setSelected("");
    try { const rows = previewLocalDrafts(raw); setDrafts(rows); if (!rows.length) setMessage("No hi ha fitxes curtes per copiar."); }
    catch (e) { setError(e instanceof Error ? e.message : "Format no compatible."); }
  }
  async function copy() {
    const draft = drafts.find(row => row.id === selected);
    if (!draft || !confirmed || pending.current) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    try {
      await privateJson("idea-drafts/local-import", localDraftPayload(draft));
      setConfirmed(false);
      setMessage("Fitxa copiada al compte privat. L’original local es conserva sense canvis.");
      await onImported();
    } catch (e) { setError(e instanceof Error ? e.message : "No s’ha pogut completar. L’original es conserva; pots tornar-ho a provar."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <details className="quelcom-transfer"><summary>Porta una fitxa local al teu compte</summary>
    <p>Només fitxes curtes. Els projectes del Site amb proves, decisions o entregues encara requereixen una migració completa; no els reduïm a una fitxa.</p>
    <fieldset disabled={busy}>
      <button type="button" onClick={() => { try { preview(localStorage.getItem(IDEA_STORAGE_KEY) || "[]"); } catch { setDrafts([]); setConfirmed(false); setError("No podem llegir el navegador. Pots carregar una exportació."); } }}>Revisa fitxes d’aquest navegador</button>
      <label>Carrega una exportació de fitxes curtes<input type="file" accept=".json,application/json" onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ""; setDrafts([]); setConfirmed(false); setError("");
        if (!file) return;
        if (file.size > 750_000) { setError("El fitxer supera el límit de 750 kB."); return; }
        try { preview(await file.text()); } catch { setError("No s’ha pogut llegir el fitxer."); }
      }} /></label>
      {drafts.length > 0 && <>
        <label>Fitxa a copiar<select value={selected} onChange={e => { setSelected(e.target.value); setConfirmed(false); setMessage(""); }}><option value="">Selecciona una fitxa</option>{drafts.map(d => <option key={d.id} value={d.id}>{d.name || d.question}</option>)}</select></label>
        {drafts.filter(d => d.id === selected).map(d => <div key={d.id}><h3>{d.name || "Idea sense nom"}</h3><p>{d.question}</p><p>Intenció: {d.intention || "Pendent"}</p><p>Propera prova: {d.nextTest || "Pendent"}</p></div>)}
        <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Confirmo la còpia privada al compte {account}. L’original local es conserva.</label>
        <button type="button" disabled={!selected || !confirmed} onClick={copy}>{busy ? "Copiant…" : "Copia la fitxa al compte privat"}</button>
        <button type="button" onClick={() => { setDrafts([]); setSelected(""); setConfirmed(false); setMessage("Còpia cancel·lada. No s’ha enviat cap fitxa."); }}>Cancel·la la preparació</button>
      </>}
    </fieldset>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </details>;
}
