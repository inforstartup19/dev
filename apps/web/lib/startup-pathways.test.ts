import { test } from "node:test";
import assert from "node:assert/strict";
import { startupCatalog, startupSelection, suggestedStartupTrack } from "./startup-pathways";
test("both tracks resolve every stage and reject unknown input", () => {
  for (const track of startupCatalog.tracks) for (const step of track.steps) assert.equal(startupSelection(track.id, step.id)?.step.id, step.id);
  assert.equal(startupSelection("unknown", "mvp"), null);
  assert.equal(startupSelection(["enlaira"], "mvp"), null);
  assert.equal(startupSelection("crea-i-creix", undefined)?.step.id, "necessitat");
});
test("orientation requires all maturity signals while funding remains optional", () => {
  for (let bits = 0; bits < 8; bits++) assert.equal(suggestedStartupTrack(!!(bits & 1), !!(bits & 2), !!(bits & 4)), bits === 7 ? "enlaira" : "crea-i-creix");
  assert.deepEqual(startupCatalog.financing.map((x) => x.id), ["pendent", "propis", "ingressos", "ajuts", "inversio"]);
});
