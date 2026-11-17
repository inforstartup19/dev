import { parseIdeaDrafts, type IdeaDraft } from "./idea-drafts";
const fields = new Set(["id", "question", "intention", "nextTest", "name", "updatedAt", "scope"]);
export function previewLocalDrafts(raw: string): IdeaDraft[] {
  if (raw.length > 750_000) throw new Error("El fitxer supera el límit de 750 kB.");
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.some(row => !row || typeof row !== "object" || Object.keys(row).some(key => !fields.has(key)))) {
    throw new Error("Aquest format no és una fitxa curta. No importem parcialment projectes amb historial, origen acadèmic o documents. Conserva l’exportació original.");
  }
  return parseIdeaDrafts(raw);
}
export function localDraftPayload(draft: IdeaDraft) {
  return { source_id: draft.id, question: draft.question, intention: draft.intention, next_test: draft.nextTest, name: draft.name };
}
export function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
