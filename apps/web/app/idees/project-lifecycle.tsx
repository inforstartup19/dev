"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { privateJson } from "../../lib/private-api";
import styles from "./project-workspace.module.css";

type Action = "pause" | "close" | "resume" | "reopen";
type State = "active" | "paused" | "closed";
type Review = "experiments" | "participants" | "agreements" | "retention";
type Event = {
  id: string;
  action: Action;
  previous_state: State;
  next_state: State;
  version: number;
  reason: string;
  review_note: string;
  reviewed: Review[];
  resume_conditions: string;
  actor_id: string;
  created_at: string;
};
type Lifecycle = {
  state: State;
  version: number;
  permitted_actions: Action[];
  blocked_operations: string[];
  last_event: Event | null;
};
const labels: Record<Action, string> = {
  pause: "Pausar operativament",
  close: "Tancar operativament",
  resume: "Reprendre després de la pausa",
  reopen: "Reobrir el projecte tancat",
};
const items: Record<Review, string> = {
  experiments: "He revisat les proves en curs i el seu impacte.",
  participants: "He revisat participants, responsables i notificacions pendents.",
  agreements: "He revisat compromisos i acords. No es cancel·len automàticament.",
  retention: "He revisat retenció, dades i propietat intel·lectual.",
};
const reviews: Review[] = ["experiments", "participants", "agreements", "retention"];
const root = (draftId: string) => `idea-drafts/${draftId}/lifecycle`;

export function ProjectLifecycle({
  draftId,
  onChanged,
}: {
  draftId: string;
  onChanged: () => Promise<unknown>;
}) {
  const [snapshot, setSnapshot] = useState<Lifecycle | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [action, setAction] = useState<Action>("pause");
  const [checked, setChecked] = useState<Review[]>([]);
  const [reason, setReason] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [conditions, setConditions] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    const [state, history] = await Promise.all([
      privateJson<Lifecycle>(root(draftId)),
      privateJson<Event[]>(`${root(draftId)}/events`),
    ]);
    setSnapshot(state);
    setEvents(history);
    setAction((previous) =>
      state.permitted_actions.includes(previous) ? previous : state.permitted_actions[0]
    );
    return state;
  }, [draftId]);

  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => {
      if (!mounted) return;
      setSnapshot(null);
      setEvents([]);
      setMessage("");
      return reload().catch(() => {
        if (mounted) setMessage("No s'ha pogut recuperar l'estat operatiu.");
      });
    });
    return () => {
      mounted = false;
    };
  }, [reload]);

  const needed = action === "close" || action === "reopen" ? reviews : reviews.slice(0, 3);
  const ready =
    !pending &&
    Boolean(snapshot) &&
    needed.every((item) => checked.includes(item)) &&
    reason.trim().length > 0 &&
    reviewNote.trim().length > 0 &&
    (action === "close" || conditions.trim().length > 0) &&
    confirm;

  function choose(next: Action) {
    setAction(next);
    setChecked([]);
    setReason("");
    setReviewNote("");
    setConditions("");
    setConfirm(false);
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !snapshot) return;
    setPending(true);
    setMessage("");
    try {
      await privateJson<Event>(`${root(draftId)}/transitions`, {
        idempotency_key: crypto.randomUUID(),
        expected_version: snapshot.version,
        action,
        reason,
        review_note: reviewNote,
        reviewed: needed,
        resume_conditions: conditions,
      });
      await reload();
      await onChanged();
      setChecked([]);
      setReason("");
      setReviewNote("");
      setConditions("");
      setConfirm(false);
      setMessage("Transició aplicada i registrada. Comprova la línia temporal.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No s'ha pogut aplicar la transició."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.panel} data-testid="project-lifecycle" aria-label="Cicle operatiu">
      <h3>Estat operatiu verificat</h3>
      <p data-testid="lifecycle-state">
        <strong>Actual: </strong>
        {snapshot ? {
          active: "Actiu",
          paused: "Pausat",
          closed: "Tancat",
        }[snapshot.state] : "Consultant..."}
        {snapshot && ` · Versió ${snapshot.version}`}
      </p>
      <p>
        Les decisions humanes són històriques; només aquest control aplica
        les restriccions operatives del projecte. Mai elimina dades ni cancela
        acords, accessos o compromisos externs.
      </p>
      {snapshot && snapshot.blocked_operations.length > 0 && (
        <p role="status">
          Noves proves, activacions, resultats i necessitats bloquejats.
          L'historial i les evidències es poden consultar.
        </p>
      )}
      {snapshot && (
        <form onSubmit={submit} className={styles.form}>
          <label>
            Acció operativa
            <select
              aria-label="Acció operativa"
              value={action}
              onChange={(event) => choose(event.target.value as Action)}
            >
              {snapshot.permitted_actions.map((item) => (
                <option key={item} value={item}>{labels[item]}</option>
              ))}
            </select>
          </label>
          <label>
            Justificació
            <textarea
              aria-label="Justificació operativa"
              required
              maxLength={3000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <fieldset className={styles.review}>
            <legend>Revisió d'impacte obligatòria</legend>
            {needed.map((item) => (
              <label key={item} className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={checked.includes(item)}
                  onChange={(event) => setChecked((previous) =>
                    event.target.checked
                      ? [...previous, item]
                      : previous.filter((value) => value !== item)
                  )}
                />
                {items[item]}
              </label>
            ))}
          </fieldset>
          <label>
            Observacions de la revisió humana
            <textarea
              aria-label="Observacions de la revisió"
              required
              maxLength={3000}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
            />
          </label>
          {action !== "close" && (
            <label>
              {action === "pause" ? "Condicions per reprendre" : "Condicions verificades per reprendre"}
              <textarea
                aria-label="Condicions de represa"
                required
                maxLength={3000}
                value={conditions}
                onChange={(event) => setConditions(event.target.value)}
              />
            </label>
          )}
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={confirm}
              onChange={(event) => setConfirm(event.target.checked)}
            />
            Confirmo l'efecte intern i que els compromisos externs no es
            consideren resolts per aquest registre.
          </label>
          <button type="submit" disabled={!ready}>{labels[action]}</button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
      <h3>Línia temporal immutable</h3>
      {events.length === 0 && <p>Encara no hi ha transicions operatives.</p>}
      <ol className={styles.history}>
        {events.map((item) => (
          <li key={item.id}>
            <strong>v{item.version} · {labels[item.action]}</strong>
            <p>{item.previous_state} → {item.next_state}</p>
            <p>{item.reason}</p>
            <small>
              {new Date(item.created_at).toLocaleString("ca-ES")}
              {" · Revisat per un usuari autenticat"}
            </small>
            <p>{item.review_note}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
