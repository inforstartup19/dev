"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { privateJson } from "../../lib/private-api";
import styles from "./inc-connect-panel.module.css";

type Need = { id: string; title: string; description: string; audience: "selected" | "authenticated" | "private" };
type Contact = {
  id: string; need_id: string; role: "owner" | "requester";
  note: string; version: number;
  status: "pending" | "accepted" | "declined" | "withdrawn";
};
type Terms = {
  goal: string; contribution: string; commitment: string;
  deliverable: string; conditions: string; access_scope: string;
};
type Agreement = {
  id: string; request_id: string; status: "active" | "cancelled";
  version: number; terms: Terms; terms_sha256: string;
  owner_confirmed: boolean; requester_confirmed: boolean;
  fully_confirmed: boolean; cancelled_reason: string;
};
const emptyTerms = (): Terms => ({
  goal: "", contribution: "", commitment: "", deliverable: "",
  conditions: "", access_scope: "Cap accés automàtic al projecte privat",
});
const labels: Record<keyof Terms, string> = {
  goal: "Objectiu compartit",
  contribution: "Aportació proposada",
  commitment: "Dedicació estimada",
  deliverable: "Resultat o lliurable",
  conditions: "Condicions de col·laboració",
  access_scope: "Accessos que es proposarien, no concedits",
};
const contactState: Record<Contact["status"], string> = {
  pending: "Pendent de resposta", accepted: "Acceptada",
  declined: "Rebutjada", withdrawn: "Retirada",
};

export function IncConnectPanel() {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [interestNeed, setInterestNeed] = useState("");
  const [interestNote, setInterestNote] = useState("");
  const [selectedRequest, setSelectedRequest] = useState("");
  const [selectedAgreement, setSelectedAgreement] = useState("");
  const [terms, setTerms] = useState<Terms>(emptyTerms);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    const [visibleNeeds, myContacts, myAgreements] = await Promise.all([
      privateJson<Need[]>("shared-needs"),
      privateJson<Contact[]>("connect-requests"),
      privateJson<Agreement[]>("agreements"),
    ]);
    setNeeds(visibleNeeds);
    setContacts(myContacts);
    setAgreements(myAgreements);
  }, []);

  useEffect(() => {
    let active = true;
    reload().catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "No hem pogut carregar Inc Connect.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  async function act(work: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await reload();
      setNotice(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha pogut completar l'acció.");
    } finally {
      setBusy(false);
    }
  }

  async function requestInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!interestNeed || !interestNote.trim()) return;
    await act(async () => {
      await privateJson(`shared-needs/${interestNeed}/connect-requests`, {
        note: interestNote.trim(),
      });
      setInterestNeed("");
      setInterestNote("");
    }, "Sol·licitud d'interès enviada amb el teu consentiment. No s'ha compartit cap dada de contacte.");
  }

  async function decide(item: Contact, decision: "accepted" | "declined" | "withdrawn") {
    await act(async () => {
      await privateJson(`connect-requests/${item.id}/transitions`, {
        expected_version: item.version, decision, confirm: true,
      });
    }, "Resposta enregistrada i auditada. Cap permís de projecte s'ha modificat.");
  }

  const contact = contacts.find((item) => item.id === selectedRequest);
  const agreement = agreements.find((item) => item.id === selectedAgreement);
  const hasAgreement = (id: string) => agreements.some((item) => item.request_id === id);

  function chooseContact(id: string) {
    setSelectedRequest(id);
    setSelectedAgreement("");
    setTerms(emptyTerms());
    setNotice("");
    setError("");
  }
  function chooseAgreement(item: Agreement) {
    setSelectedAgreement(item.id);
    setSelectedRequest(item.request_id);
    setTerms({ ...item.terms });
    setNotice("");
    setError("");
  }
  function changeTerm(key: keyof Terms, value: string) {
    setTerms((current) => ({ ...current, [key]: value }));
  }
  const validTerms = Object.values(terms).every((value) => value.trim().length > 0);
  const versionEdited = agreement &&
    Object.keys(labels).some((key) =>
      terms[key as keyof Terms].trim() !== agreement.terms[key as keyof Terms]);
  const freshAgreement = contact?.status === "accepted" && !hasAgreement(contact.id);

  async function createAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contact || !freshAgreement || !validTerms) return;
    await act(async () => {
      const result = await privateJson<Agreement>("agreements", {
        request_id: contact.id, terms,
      });
      setSelectedAgreement(result.id);
    }, "Proposta privada registrada. Encara requereix dues confirmacions independents.");
  }

  async function reviseAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agreement || !validTerms || !versionEdited) return;
    await act(async () => {
      await privateJson(`agreements/${agreement.id}/revisions`, {
        expected_version: agreement.version, terms,
      });
    }, "Nova versió registrada. Les confirmacions anteriors ja no compten.");
  }

  async function confirmAgreement() {
    if (!agreement || versionEdited || agreement.status !== "active") return;
    await act(async () => {
      await privateJson(`agreements/${agreement.id}/confirmations`, {
        expected_version: agreement.version,
        expected_hash: agreement.terms_sha256,
        confirm: true,
      });
    }, "Has confirmat aquesta versió. L'acord només es completa quan l'altra part també la confirma.");
  }

  async function cancelAgreement() {
    if (!agreement || !reason.trim()) return;
    await act(async () => {
      await privateJson(`agreements/${agreement.id}/cancel`, {
        expected_version: agreement.version, reason: reason.trim(), confirm: true,
      });
      setReason("");
    }, "Proposta cancel·lada. Les dades històriques continuen consultables.");
  }

  return (
    <section className={styles.section} data-testid="inc-connect-panel" aria-label="Inc Connect i Agreements">
      <div className={styles.header}>
        <div>
          <span className={styles.kicker}>INC CONNECT · PROJECTE VIU</span>
          <h2>Connectar sense exposar el projecte</h2>
          <p>Només es mostren necessitats que pots consultar i interaccions on participes. No hi ha missatgeria ni accés implícit a fitxers.</p>
        </div>
        <button type="button" disabled={busy || loading} onClick={() =>
          act(reload, "Dades actualitzades.")}>Actualitzar</button>
      </div>
      {loading && <p role="status">Carregant les teves connexions...</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className={styles.columns}>
        <section className={styles.panel} aria-label="Necessitats accessibles">
          <h3>Necessitats accessibles</h3>
          {needs.length === 0 && <p>No hi ha necessitats disponibles per al teu compte.</p>}
          {needs.map((need) => (
            <article className={styles.item} key={need.id}>
              <strong>{need.title}</strong>
              <p>{need.description}</p>
              <small>{need.audience === "selected" ? "Accés individual autoritzat" : "Comptes autenticats"}</small>
              <button type="button" disabled={busy} onClick={() => {
                setInterestNeed(need.id);
                setInterestNote("");
              }}>M'interessa aquesta necessitat</button>
            </article>
          ))}
          {interestNeed && <form className={styles.form} onSubmit={requestInterest}>
            <label>Missatge breu d'interès, enviat voluntàriament
              <textarea aria-label="Nota d'interès" required maxLength={500}
                value={interestNote} onChange={(event) => setInterestNote(event.target.value)} />
            </label>
            <button type="submit" disabled={busy || !interestNote.trim()}>Enviar petició consentida</button>
            <button type="button" disabled={busy} onClick={() => setInterestNeed("")}>Cancel·lar</button>
          </form>}
        </section>
        <section className={styles.panel} aria-label="Peticions i propostes">
          <h3>Les meves connexions</h3>
          {contacts.length === 0 && <p>Encara no hi ha peticions de contacte.</p>}
          {contacts.map((item) => (
            <article className={styles.item} key={item.id} data-testid="connect-request">
              <strong>{item.role === "owner" ? "Interès rebut" : "Interès enviat"}</strong>
              <p>{item.note}</p>
              <small>{contactState[item.status]} · v{item.version}</small>
              {item.status === "pending" && item.role === "owner" && <>
                <button type="button" disabled={busy} onClick={() => decide(item, "accepted")}>Acceptar interès</button>
                <button type="button" disabled={busy} onClick={() => decide(item, "declined")}>Rebutjar interès</button>
              </>}
              {item.status === "pending" && item.role === "requester" &&
                <button type="button" disabled={busy} onClick={() => decide(item, "withdrawn")}>Retirar la meva petició</button>}
              {item.status === "accepted" && <button type="button"
                onClick={() => chooseContact(item.id)}>
                {hasAgreement(item.id) ? "Veure propostes" : "Preparar una proposta d'acord"}
              </button>}
            </article>
          ))}
          {contact?.status === "accepted" && !hasAgreement(contact.id) && <form
            className={styles.form} onSubmit={createAgreement}>
            <h3>Proposta bilateral · v1</h3>
            {(Object.keys(labels) as (keyof Terms)[]).map((key) => (
              <label key={key}>{labels[key]}
                <textarea required maxLength={key === "commitment" || key === "access_scope" ? 500 : 1200}
                  value={terms[key]} onChange={(event) => changeTerm(key, event.target.value)} />
              </label>
            ))}
            <p>Els accessos són només una proposta. Cap confirmació constitueix una signatura jurídica.</p>
            <button type="submit" disabled={busy || !validTerms}>Crear proposta privada</button>
          </form>}
        </section>
        <section className={styles.panel} aria-label="Acords versionats">
          <h3>Acords i revisions</h3>
          {agreements.length === 0 && <p>Encara no hi ha propostes bilaterals.</p>}
          {agreements.map((item) => (
            <button type="button" key={item.id} className={styles.choice}
              aria-pressed={selectedAgreement === item.id} onClick={() => chooseAgreement(item)}>
              Versió {item.version} · {item.status === "cancelled" ? "Cancel·lada" :
                item.fully_confirmed ? "Confirmada per ambdues parts" : "Pendent de confirmacions"}
            </button>
          ))}
          {agreement && <div className={styles.form} data-testid="agreement-review">
            <h3>Revisió exacta de la versió {agreement.version}</h3>
            <small>Hash: {agreement.terms_sha256}</small>
            <p>Part A: {agreement.owner_confirmed ? "Confirmada" : "Pendent"} · Part B: {agreement.requester_confirmed ? "Confirmada" : "Pendent"}</p>
            {(Object.keys(labels) as (keyof Terms)[]).map((key) => (
              <label key={key}>{labels[key]}
                <textarea value={terms[key]} disabled={busy || agreement.status !== "active"}
                  maxLength={key === "commitment" || key === "access_scope" ? 500 : 1200}
                  onChange={(event) => changeTerm(key, event.target.value)} />
              </label>
            ))}
            {agreement.status === "active" && <>
              <button type="button" disabled={busy || !validTerms || !versionEdited}
                onClick={(event) => reviseAgreement(event as unknown as FormEvent<HTMLFormElement>)}>
                Desar nova versió (anul·la confirmacions anteriors)
              </button>
              <button type="button" disabled={busy || Boolean(versionEdited)}
                onClick={confirmAgreement}>Confirmar exactament aquesta versió</button>
              <label>Motiu de cancel·lació
                <input maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
              <button type="button" disabled={busy || !reason.trim()} onClick={cancelAgreement}>
                Cancel·lar la proposta
              </button>
            </>}
            {agreement.status === "cancelled" && <p>Cancel·lada: {agreement.cancelled_reason}</p>}
            <small>Les confirmacions no obren permisos, no envien contactes ni són signatures legals.</small>
          </div>}
        </section>
      </div>
    </section>
  );
}
