import catalog from "../../../shared/startup-pathways.json";
export const startupCatalog = catalog;
export function startupSelection(track: unknown, step: unknown) {
  const selected = catalog.tracks.find((item) => item.id === track);
  if (!selected) return null;
  return { track: selected, step: selected.steps.find((item) => item.id === step) || selected.steps[0] };
}
export function suggestedStartupTrack(need: boolean, mvp: boolean, evidence: boolean) {
  return need && mvp && evidence ? "enlaira" : "crea-i-creix";
}
