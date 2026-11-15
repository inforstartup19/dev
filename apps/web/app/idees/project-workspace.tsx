"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PrivateError, privateJson } from "../../lib/private-api";
import styles from "./project-workspace.module.css";

type Experiment = {
  id: string;
  draft_id: string;
  reformulates_id: string | null;
  question: string;
  method: string;
  success_criterion: string;
  status: "draft" | "active" | "completed";
  created_at: string;
};
type Evidence = {
  id: string;
  reference: string;
  source_note: string;
  review_status: "declared";
};
type Result = {
  id: string;
  outcome: "supportive" | "unsupported" | "inconclusive";
  observations: string;
  created_at: string;
  evidence: Evidence[];
};
type Decision = {
  id: string;
  experiment_id: string | null;
  choice: "continue" | "reformulate" | "request_help" | "pause" | "close";
  rationale: string;
  created_at: string;
};
type Resource = {
  id: string;
  kind: "person" | "resources" | "funding";
  description: string;
  created_at: string;
};
type ExperimentInput = {
  question: string;
  method: string;
  success_criterion: string;
};
const blank = (): ExperimentInput => ({
  question: "", method: "", success_criterion: "",
});
const outcomes: Record<Result["outcome"], string> = {
  supportive: "Indicis favorables",
  unsupported: "No confirma la hipòtesi",
  inconclusive: "Inconcloent",
};
const choices: Record<Decision["choice"], string> = {
  continue: "Continuar",
  reformulate: "Reformular",
  request_help: "Demanar ajuda",
  pause: "Pausar",
  close: "Tancar",
};
const base = (id: string) => `idea-drafts/${id}`;

export function ProjectWorkspace({ draftId }: { draftId: string }) {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [fields, setFields] = useState<ExperimentInput>(blank);
  const [observations, setObservations] = useState("");
  const [outcome, setOutcome] = useState<Result["outcome"]>("inconclusive");
  const [reference, setReference] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [decisionChoice, setDecisionChoice] = useState<Decision["choice"]>("continue");
  const [rationale, setRationale] = useState("");
  const [kind, setKind] = useState<Resource["kind"]>("person");
  const [description, setDescription] = useState("");
  const [showResources, setShowResources] = useState(false);
  const [showDecisions, setShowDecisions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [needsStepUp, setNeedsStepUp] = useState(false);

  const report = useCallback((err: unknown) => {
    setNeedsStepUp(err instanceof PrivateError && err.code === "step_up_required");
    setError(err instanceof Error ? err.message : "No s'ha pogut completar l'acció.");
  }, []);

  const refresh = useCallback(async () => {
    const root = base(draftId);
    const [tests, choicesList, resourceList] = await Promise.all([
      privateJson<Experiment[]>(`${root}/experiments`),
      privateJson<Decision[]>(`${root}/decisions`),
      privateJson<Resource[]>(`${root}/resource-intents`),
    ]);
    setExperiments(tests);
    setDecisions(choicesList);
    setResources(resourceList);
    return tests;
  }, [draftId]);

  useEffect(() => {
    let mounted = true;
    // Avoid displaying any previous project's protected records while reloading.
    Promise.resolve().then(() => {
      if (!mounted) return;
      setExperiments([]);
      setResults([]);
      setDecisions([]);
      setResources([]);
      setSelected(null);
      setFields(blank());
      setLoading(true);
      setError("");
      setInfo("");
      return refresh().catch((err) => { if (mounted) report(err); })
        .finally(() => { if (mounted) setLoading(false); });
    });
    return () => { mounted = false; };
  }, [refresh, report]);

  const chosen = experiments.find((experiment) => experiment.id === selected);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setResults([]);
      if (!selected) return;
      return privateJson<Result[]>(`${base(draftId)}/experiments/${selected}/results`)
        .then((records) => { if (active) setResults(records); })
        .catch((err) => { if (active) report(err); });
    });
    return () => { active = false; };
  }, [draftId, selected, report]);

  async function action(task: () => Promise<void>, success: string) {
    if (busy || loading) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await task();
      await refresh();
      setInfo(success);
    } catch (err) { report(err); }
    finally { setBusy(false); }
  }

  async function saveExperiment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const previous = chosen;
    await action(async () => {
      const payload = { ...fields };
      const root = `${base(draftId)}/experiments`;
      let result: Experiment;
      if (previous?.status === "draft") {
        result = await privateJson<Experiment>(`${root}/${previous.id}`, payload);
      } else {
        result = await privateJson<Experiment>(root, payload);
      }
      setSelected(result.id);
    }, "Prova desada de manera privada al backend.");
  }

  async function activate() {
    if (!chosen) return;
    await action(async () => {
      await privateJson(`${base(draftId)}/experiments/${chosen.id}/activate`, {});
    }, "Prova activada. El registre de resultats està disponible.");
  }

  async function saveResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen) return;
    await action(async () => {
      await privateJson(
        `${base(draftId)}/experiments/${chosen.id}/results`,
        {
          outcome,
          observations,
          evidence: reference.trim()
            ? [{ reference, source_note: sourceNote }] : [],
        },
      );
      setObservations("");
      setReference("");
      setSourceNote("");
      setResults(await privateJson<Result[]>(
        `${base(draftId)}/experiments/${chosen.id}/results`,
      ));
    }, "Resultat i evidència declarada desats. No s'han publicat.");
  }

  async function saveDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await action(async () => {
      await privateJson(`${base(draftId)}/decisions`, {
        choice: decisionChoice,
        rationale,
        experiment_id: chosen?.status === "draft" ? null : chosen?.id ?? null,
      });
      setRationale("");
      setShowDecisions(true);
    }, "Decisió humana registrada, sense cap canvi automàtic de visibilitat.");
  }

  async function saveResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await action(async () => {
      await privateJson(`${base(draftId)}/resource-intents`, {
        kind, description,
      });
      setDescription("");
    }, "Necessitat privada desada. No s'ha enviat cap invitació.");
  }

  function selectExperiment(experiment: Experiment) {
    setSelected(experiment.id);
    setFields({
      question: experiment.question, method: experiment.method,
      success_criterion: experiment.success_criterion,
    });
    setError("");
  }

  function newExperiment() {
    setSelected(null);
    setFields(blank());
    setResults([]);
    setError("");
  }

  async function reformulate() {
    if (!chosen || chosen.status !== "completed") return;
    await action(async () => {
      const next = await privateJson<Experiment>(`${base(draftId)}/experiments`, {
        reformulates_id: chosen.id,
      });
      setSelected(next.id);
      setFields(blank());
    }, "Nova prova vinculada a l'anterior, sense esborrar l'historial.");
  }

  return (
    <section className={styles.workspace} aria-label="Projecte Viu" data-testid="project-workspace">
      <div className={styles.heading}>
        <div><span className={styles.kicker}>PROJECTE VIU · COMPTE PRIVAT</span>
          <h2>Proves, evidències i decisions</h2>
          <p>Tot es desa al teu compte. No es publica automàticament.</p>
        </div>
        <button type="button" onClick={newExperiment}>+ Nova prova</button>
      </div>
      {loading && <p role="status">Carregant el Projecte Viu...</p>}
      {error && <p role="alert">{error}</p>}
      {needsStepUp && <Link href="/login?next=/idees">Reforça l’autenticació</Link>}
      {info && <p role="status">{info}</p>}
      {!loading && <div className={styles.columns}>
        <div className={styles.panel}>
          <h3>Historial de proves</h3>
          {experiments.length === 0 && <p>Encara no has preparat cap prova.</p>}
          {experiments.map((experiment) => (
            <button type="button" key={experiment.id}
              aria-pressed={selected === experiment.id}
              onClick={() => selectExperiment(experiment)}
              className={selected === experiment.id ? styles.selected : styles.row}>
              <strong>{experiment.question || "Prova incompleta"}</strong>
              <small>{experiment.status} {experiment.reformulates_id && "· Reformulació"}</small>
            </button>
          ))}
          <form onSubmit={saveExperiment} className={styles.form}>
            <h3>{chosen?.status === "draft" ? "Completar prova" : "Preparar prova"}</h3>
            <label>Pregunta de la prova
              <textarea value={fields.question} maxLength={2000}
                onChange={(e) => setFields((s) => ({ ...s, question: e.target.value }))} />
            </label>
            <label>Mètode
              <textarea value={fields.method} maxLength={3000}
                onChange={(e) => setFields((s) => ({ ...s, method: e.target.value }))} />
            </label>
            <label>Criteri de contrast
              <textarea value={fields.success_criterion} maxLength={3000}
                onChange={(e) => setFields((s) => ({ ...s, success_criterion: e.target.value }))} />
            </label>
            <button disabled={busy || Boolean(chosen && chosen.status !== "draft")} type="submit">
              Desar prova privada
            </button>
          </form>
          {chosen?.status === "draft" &&
            <button disabled={busy} type="button" onClick={activate}>Activar prova</button>}
          {chosen?.status === "completed" &&
            <button disabled={busy} type="button" onClick={reformulate}>Reformular aquesta prova</button>}
        </div>
        <div className={styles.panel}>
          <h3>Resultats i evidències</h3>
          {!chosen && <p>Selecciona una prova del teu projecte.</p>}
          {chosen && <p>Estat: {chosen.status}</p>}
          <ol className={styles.history}>
            {results.map((result) => <li key={result.id}>
              <strong>{outcomes[result.outcome]}</strong>
              <p>{result.observations}</p>
              <small>{new Date(result.created_at).toLocaleString("ca-ES")}</small>
              {result.evidence.map((evidence) => <p key={evidence.id}>
                Evidència declarada: {evidence.reference}
                {evidence.source_note && ` — ${evidence.source_note}`}
              </p>)}
            </li>)}
          </ol>
          {chosen && chosen.status !== "draft" && <form onSubmit={saveResult} className={styles.form}>
            <label>Resultat
              <select value={outcome}
                onChange={(e) => setOutcome(e.target.value as Result["outcome"])}>
                {Object.entries(outcomes).map(([key, label]) =>
                  <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label>Observacions
              <textarea required maxLength={5000} value={observations}
                onChange={(e) => setObservations(e.target.value)} />
            </label>
            <label>Referència d'evidència (opcional)
              <input maxLength={2000} value={reference}
                onChange={(e) => setReference(e.target.value)} />
            </label>
            <label>Origen o nota de l'evidència
              <input maxLength={2000} value={sourceNote}
                onChange={(e) => setSourceNote(e.target.value)} />
            </label>
            <button type="submit" disabled={busy}>Registrar resultat</button>
            <small>Les evidències són declarades, no verificades per Inc.</small>
          </form>}
        </div>
      </div>}
      {!loading && <div className={styles.columns}>
        <div className={styles.panel}>
          <button type="button" aria-expanded={showDecisions}
            onClick={() => setShowDecisions(!showDecisions)}>
            {showDecisions ? "Amagar decisions" : "Decidir com continuar"}
          </button>
          {showDecisions && <>
            <form className={styles.form} onSubmit={saveDecision}>
              <label htmlFor="project-decision-choice">Decisió</label>
                <select id="project-decision-choice" value={decisionChoice}
                  onChange={(e) => setDecisionChoice(e.target.value as Decision["choice"])}>
                  {Object.entries(choices).map(([key, label]) =>
                    <option key={key} value={key}>{label}</option>)}
                </select>
              <label>Motiu i proper pas
                <textarea required maxLength={3000} value={rationale}
                  onChange={(e) => setRationale(e.target.value)} />
              </label>
              <button type="submit" disabled={busy}>Registrar decisió humana</button>
            </form>
            <ol className={styles.history}>
              {decisions.map((d) => <li key={d.id}>
                <strong>{choices[d.choice]}</strong>: {d.rationale}
              </li>)}
            </ol>
            <small>Pausar o tancar no elimina dades, no finalitza acords ni canvia la visibilitat.</small>
          </>}
        </div>
        <div className={styles.panel}>
          <button type="button" aria-expanded={showResources}
            onClick={() => setShowResources(!showResources)}>
            {showResources ? "Amagar necessitats" : "Afegir equip, recursos o finançament"}
          </button>
          {showResources && <>
            <p>Opcional. Només prepara la necessitat dins del projecte privat.</p>
            <form className={styles.form} onSubmit={saveResource}>
              <label>Què necessites?
                <select value={kind}
                  onChange={(e) => setKind(e.target.value as Resource["kind"])}>
                  <option value="person">Una persona</option>
                  <option value="resources">Recursos</option>
                  <option value="funding">Finançament</option>
                </select>
              </label>
              <label>Descripció
                <textarea required maxLength={3000} value={description}
                  onChange={(e) => setDescription(e.target.value)} />
              </label>
              <button disabled={busy} type="submit">Desar necessitat privada</button>
            </form>
            <ol className={styles.history}>{resources.map((r) =>
              <li key={r.id}>{r.kind}: {r.description}</li>)}</ol>
            <small>Sense contactes, invitacions ni publicació automàtica.</small>
          </>}
        </div>
      </div>}
    </section>
  );
}
