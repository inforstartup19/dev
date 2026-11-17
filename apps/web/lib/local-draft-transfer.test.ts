import { test } from "node:test";
import assert from "node:assert/strict";
import { previewLocalDrafts, localDraftPayload } from "./local-draft-transfer";
import { privateRoute } from "./private-policy";
const sample = { id: "local-1", question: "Idea", intention: "", name: "", nextTest: "", updatedAt: "2026-11-17T10:00:00Z", scope: "personal-local" };
test("preview is read only, preserves local id, and maps only explicitly supported fields", () => {
  const rows = previewLocalDrafts(JSON.stringify([sample]));
  assert.equal(rows[0].id, sample.id);
  assert.deepEqual(localDraftPayload(rows[0]), { source_id: "local-1", question: "Idea", intention: "", name: "", next_test: "" });
});
test("no partial import of Site project histories, unknown fields, corrupt or oversized exports", () => {
  for (const value of [{ projects: [sample] }, [{ ...sample, live: { origin: "TFG" } }], [{ ...sample, history: [] }], [{ ...sample, scope: "public" }], [sample, sample]]) assert.throws(() => previewLocalDrafts(JSON.stringify(value)));
  assert.throws(() => previewLocalDrafts("{"));
  assert.throws(() => previewLocalDrafts(" ".repeat(750001)));
});
test("BFF permits only POST on exact local-import endpoint", () => {
  assert.equal(privateRoute("POST", ["idea-drafts", "local-import"]), "json");
  for (const method of ["GET", "DELETE", "PUT"]) assert.equal(privateRoute(method, ["idea-drafts", "local-import"]), null);
  assert.equal(privateRoute("POST", ["idea-drafts", "local-import", "extra"]), null);
});
