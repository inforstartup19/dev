import { test, expect, type Page } from "@playwright/test";

test.skip(
  process.env.RUN_CONNECTED_E2E !== "1",
  "Requires isolated OIDC and API test services.",
);

async function login(page: Page, account: "Professor" | "Alumne" | "Tercer") {
  await page.goto("http://localhost:3400/idees");
  await page.getByRole("button", { name: "Continua amb el teu compte", exact: true }).click();
  await page.getByRole("link", { name: `${account} de proves`, exact: true }).click();
  await expect(page).toHaveURL(/\/idees$/);
}

test("BF Projecte Viu persists evidence and decisions without exposing another account", async ({ browser }) => {
  test.setTimeout(150000);
  const ownerContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const strangerContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const owner = await ownerContext.newPage();
  const stranger = await strangerContext.newPage();
  try {
    await login(owner, "Professor");
    await owner.getByLabel("Pregunta o necessitat").fill("Com validem BF 1-of-1?");
    await owner.getByLabel("Nom provisional").fill("BF — Be First");
    await owner.getByRole("button", { name: "Desa al compte privat" }).click();
    await expect(owner.getByTestId("project-workspace")).toBeVisible();
    const records = await (await owner.request.get(
      "http://localhost:3400/api/private/idea-drafts",
    )).json();
    const id = records.find((r: { name: string }) => r.name === "BF — Be First").id;
    const root = `http://localhost:3400/api/private/idea-drafts/${id}`;

    await owner.getByLabel("Pregunta de la prova").fill("Entenen el model 1-of-1?");
    await owner.getByLabel("Mètode").fill("Prova sintètica amb tres conceptes.");
    await owner.getByLabel("Criteri de contrast").fill("Registrar objeccions.");
    await owner.getByRole("button", { name: "Desar prova privada" }).click();
    await expect(owner.getByText("Prova desada de manera privada al backend.")).toBeVisible();
    await owner.getByLabel("Observacions", { exact: true }).fill("Resposta de prova inconcloent.");
    await owner.getByLabel("Referència d'evidència (opcional)").fill("BF-UX-EVIDENCE-001");
    await owner.getByRole("button", { name: "Registrar resultat" }).click();
    await expect(owner.getByText(/BF-UX-EVIDENCE-001/)).toBeVisible();

    await owner.getByRole("button", { name: "Decidir com continuar" }).click();
    await owner.locator("#project-decision-choice").selectOption("reformulate");
    await owner.getByLabel("Motiu i proper pas").fill("Ampliar la mostra sintètica.");
    await owner.getByRole("button", { name: "Registrar decisió humana" }).click();
    await expect(owner.getByText("Ampliar la mostra sintètica.")).toBeVisible();
    await owner.reload();
    await owner.getByRole("button", { name: /BF — Be First/ }).click();
    await expect(owner.getByTestId("project-workspace")).toBeVisible();
    await owner.getByRole("button", { name: "Entenen el model 1-of-1?" }).click();
    await expect(owner.getByText(/BF-UX-EVIDENCE-001/)).toBeVisible();
    await owner.getByRole("button", { name: "Decidir com continuar" }).click();
    await expect(owner.getByText("Ampliar la mostra sintètica.")).toBeVisible();

    await login(stranger, "Alumne");
    await expect(stranger.getByText("BF — Be First")).toHaveCount(0);
    for (const suffix of ["/experiments", "/decisions", "/resource-intents"]) {
      const response = await stranger.request.get(root + suffix);
      expect(response.status()).toBe(404);
    }
    const forbidden = await stranger.request.post(root + "/decisions", {
      headers: { Origin: "http://localhost:3400" },
      data: { choice: "close", rationale: "Unauthorized" },
    });
    expect(forbidden.status()).toBe(404);
    expect((await (await owner.request.get(root)).json()).visibility).toBe("private");
  } finally {
    await Promise.allSettled([ownerContext.close(), strangerContext.close()]);
  }
});

test("BF lifecycle pauses execution, preserves evidence and can resume with owner controls", async ({ browser }) => {
  test.setTimeout(150000);
  const ownerContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const strangerContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const owner = await ownerContext.newPage();
  const stranger = await strangerContext.newPage();
  try {
    await login(owner, "Professor");
    await owner.getByLabel("Pregunta o necessitat").fill("BF: quan pausar un pilot 1-of-1?");
    await owner.getByLabel("Nom provisional").fill("BF — Lifecycle Pilot");
    await owner.getByRole("button", { name: "Desa al compte privat" }).click();
    await expect(owner.getByTestId("project-lifecycle")).toBeVisible();
    const records = await (await owner.request.get(
      "http://localhost:3400/api/private/idea-drafts",
    )).json();
    const id = records.find((r: { name: string }) => r.name === "BF — Lifecycle Pilot").id;
    const root = `http://localhost:3400/api/private/idea-drafts/${id}`;
    await expect(owner.getByTestId("lifecycle-state")).toContainText("Actiu");

    const panel = owner.getByTestId("project-lifecycle");
    await panel.getByLabel("Justificació operativa").fill("Pilot BF pendent de contrast.");
    await panel.getByLabel("Observacions de la revisió")
      .fill("Responsables i compromisos revisats amb dades sintètiques.");
    await panel.getByLabel("Condicions de represa")
      .fill("Validar les dades i autoritzar nova prova.");
    const checks = panel.getByRole("checkbox");
    await checks.nth(0).check();
    await checks.nth(1).check();
    await checks.nth(2).check();
    await checks.nth(3).check();
    await panel.getByRole("button", { name: "Pausar operativament" }).click();
    await expect(owner.getByTestId("lifecycle-state")).toContainText("Pausat");
    await expect(owner.getByRole("button", { name: "+ Nova prova" })).toBeDisabled();
    expect((await owner.request.post(root + "/experiments", {
      headers: { Origin: "http://localhost:3400" },
      data: {},
    })).status()).toBe(409);

    await panel.getByLabel("Justificació operativa").fill("Reprenc després de verificació.");
    await panel.getByLabel("Observacions de la revisió")
      .fill("Proves revisades, tercers informats si correspon.");
    await panel.getByLabel("Condicions de represa")
      .fill("Verificació humana completada.");
    for (let index = 0; index < 4; index++) await checks.nth(index).check();
    await panel.getByRole("button", { name: "Reprendre després de la pausa" }).click();
    await expect(owner.getByTestId("lifecycle-state")).toContainText("Actiu");
    await expect(owner.getByRole("button", { name: "+ Nova prova" })).toBeEnabled();
    await expect(panel.getByText("v1 · Pausar operativament")).toBeVisible();
    await expect(panel.getByText("v2 · Reprendre després de la pausa")).toBeVisible();

    await login(stranger, "Alumne");
    expect((await stranger.request.get(root + "/lifecycle")).status()).toBe(404);
    expect((await stranger.request.get(root + "/lifecycle/events")).status()).toBe(404);
    expect((await stranger.request.post(root + "/lifecycle/transitions", {
      headers: { Origin: "http://localhost:3400" },
      data: {
        idempotency_key: "fd238593-66c0-4872-8cd8-7aebcd9b0a70",
        expected_version: 2,
        action: "pause",
        reason: "Intent aliè",
        review_note: "No autoritzat",
        reviewed: ["experiments", "participants", "agreements"],
        resume_conditions: "Intent aliè",
      },
    })).status()).toBe(404);
    expect((await (await owner.request.get(root)).json()).visibility).toBe("private");
  } finally {
    await Promise.allSettled([ownerContext.close(), strangerContext.close()]);
  }
});


test("BF sharing publishes only a need to another account and revokes it without opening the project", async ({ browser }) => {
  test.setTimeout(150000);
  const ownerContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const outsiderContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const owner = await ownerContext.newPage();
  const outsider = await outsiderContext.newPage();
  const origin = "http://localhost:3400";
  try {
    await login(owner, "Professor");
    const facets = owner.getByTestId("identity-facets");
    await facets.getByLabel("Presentació privada").fill("BF · creador");
    await facets.getByRole("button", { name: "Desar faceta privada" }).click();
    await expect(facets.getByText(/no concedeix accés a cap projecte/)).toBeVisible();

    await owner.getByLabel("Pregunta o necessitat").fill("Com validar BF90?");
    await owner.getByLabel("Intenció").fill("Pressupost intern que no es publica");
    await owner.getByLabel("Nom provisional").fill("BF — Selective Need Pilot");
    await owner.getByRole("button", { name: "Desa al compte privat" }).click();
    await expect(owner.getByTestId("project-workspace")).toBeVisible();
    const records = await (await owner.request.get(`${origin}/api/private/idea-drafts`)).json();
    const parent = records.find((item: { name: string }) =>
      item.name === "BF — Selective Need Pilot");
    expect(parent).toBeTruthy();
    const root = `${origin}/api/private/idea-drafts/${parent.id}`;

    const panel = owner.getByTestId("project-needs");
    await panel.getByLabel("Títol de la necessitat").fill("Taller de confecció 1-of-1");
    await panel.getByLabel("Text que podria veure un altre compte")
      .fill("Busquem un taller per validar una peça original.");
    await panel.getByRole("button", { name: "Preparar necessitat privada" }).click();
    await expect(panel.getByTestId("need-preview")).toContainText("Taller de confecció 1-of-1");
    const ownerNeeds = await (await owner.request.get(root + "/shared-needs")).json();
    const needId = ownerNeeds[0].id;

    await login(outsider, "Alumne");
    expect((await (await outsider.request.get(`${origin}/api/private/shared-needs`)).json())).toEqual([]);
    expect((await outsider.request.get(root)).status()).toBe(404);
    expect((await outsider.request.get(root + "/shared-needs")).status()).toBe(404);
    expect((await outsider.request.get(`${origin}/api/private/shared-needs/${needId}`)).status()).toBe(404);

    const viewer = await (await outsider.request.get(`${origin}/api/campus/me`)).json();
    await panel.getByLabel("Identificador del destinatari autoritzat").fill(viewer.id);
    await panel.getByRole("button", { name: "Afegir destinatari a aquesta necessitat" }).click();
    await expect(panel.getByText(/Destinatari autoritzat per a aquesta necessitat/)).toBeVisible();
    await panel.getByLabel("Motiu de publicació").fill("Només el text revisat");
    await panel.getByRole("checkbox", { name: /Confirmo l'audiència/ }).check();
    await panel.getByRole("button", { name: "Publicar només aquesta necessitat" }).click();
    await expect(panel.getByText(/Necessitat publicada per a comptes autenticats/)).toBeVisible();
    const visible = await (await outsider.request.get(`${origin}/api/private/shared-needs`)).json();
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({
      audience: "selected", id: needId, title: "Taller de confecció 1-of-1",
      description: "Busquem un taller per validar una peça original.",
      state: "published",
    });
    expect(JSON.stringify(visible)).not.toContain("Pressupost intern");
    expect(JSON.stringify(visible)).not.toContain("BF — Selective Need Pilot");
    expect(JSON.stringify(visible)).not.toContain("draft_id");
    expect((await outsider.request.get(root)).status()).toBe(404);
    expect((await outsider.request.get(root + "/shared-needs/" + needId + "/events")).status()).toBe(404);
    expect((await outsider.request.post(root + "/shared-needs/" + needId + "/revoke", {
      headers: { Origin: origin },
      data: { expected_version: 1, confirm: true, reason: "Intent aliè" },
    })).status()).toBe(404);

    await panel.getByLabel("Motiu de revocació").fill("Necessitat coberta");
    await panel.getByRole("checkbox", { name: /Confirmo l'audiència/ }).check();
    await panel.getByRole("button", { name: "Revocar aquesta necessitat" }).click();
    await expect(panel.getByText(/Necessitat revocada/)).toBeVisible();
    expect((await (await outsider.request.get(`${origin}/api/private/shared-needs`)).json())).toEqual([]);
    expect((await outsider.request.get(`${origin}/api/private/shared-needs/${needId}`)).status()).toBe(404);
    expect((await (await owner.request.get(root)).json()).visibility).toBe("private");
  } finally {
    await Promise.allSettled([ownerContext.close(), outsiderContext.close()]);
  }
});


test("BF Connect and Agreements UX needs two consenting accounts without sharing the project", async ({ browser }) => {
  test.setTimeout(150000);
  const ownerContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const collaboratorContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const owner = await ownerContext.newPage();
  const collaborator = await collaboratorContext.newPage();
  const origin = "http://localhost:3400";
  try {
    await login(owner, "Professor");
    await login(collaborator, "Alumne");
    const ownerView = owner.getByTestId("inc-connect-panel");
    const otherView = collaborator.getByTestId("inc-connect-panel");
    await expect(ownerView).toBeVisible();
    await expect(otherView).toBeVisible();

    await owner.getByLabel("Pregunta o necessitat").fill("BF: taller per prototip?");
    await owner.getByLabel("Nom provisional").fill("BF — Connect UX");
    await owner.getByRole("button", { name: "Desa al compte privat" }).click();
    await expect(owner.getByTestId("project-workspace")).toBeVisible();
    const drafts = await (await owner.request.get(`${origin}/api/private/idea-drafts`)).json();
    const draft = drafts.find((item: { name: string }) => item.name === "BF — Connect UX");
    expect(draft).toBeTruthy();
    const root = `${origin}/api/private/idea-drafts/${draft.id}`;

    const needPanel = owner.getByTestId("project-needs");
    await needPanel.getByLabel("Títol de la necessitat").fill("Taller BF 1-of-1");
    await needPanel.getByLabel("Text que podria veure un altre compte")
      .fill("Busquem un professional per validar un prototip.");
    await needPanel.getByRole("button", { name: "Preparar necessitat privada" }).click();
    await expect(needPanel.getByTestId("need-preview")).toBeVisible();
    const viewer = await (await collaborator.request.get(`${origin}/api/campus/me`)).json();
    await needPanel.getByLabel("Identificador del destinatari autoritzat").fill(viewer.id);
    await needPanel.getByRole("button", { name: "Afegir destinatari a aquesta necessitat" }).click();
    await expect(needPanel.getByText(/Destinatari autoritzat/)).toBeVisible();
    await needPanel.getByLabel("Motiu de publicació").fill("Pilot de contacte només per B");
    await needPanel.getByRole("checkbox", { name: /Confirmo l'audiència/ }).check();
    await needPanel.getByRole("button", { name: "Publicar només aquesta necessitat" }).click();
    await expect(needPanel.getByText(/Necessitat publicada/)).toBeVisible();

    await otherView.getByRole("button", { name: "Actualitzar" }).click();
    await expect(otherView.getByText("Taller BF 1-of-1")).toBeVisible();
    await otherView.getByRole("button", { name: "M'interessa aquesta necessitat" }).click();
    await otherView.getByLabel("Nota d'interès")
      .fill("Puc fer una mostra de prova sintètica.");
    await otherView.getByRole("button", { name: "Enviar petició consentida" }).click();
    await expect(otherView.getByText(/Sol·licitud d'interès enviada/)).toBeVisible();

    await ownerView.getByRole("button", { name: "Actualitzar" }).click();
    await expect(ownerView.getByText("Interès rebut")).toBeVisible();
    await ownerView.getByRole("button", { name: "Acceptar interès" }).click();
    await expect(ownerView.getByText(/Resposta enregistrada i auditada/)).toBeVisible();

    await otherView.getByRole("button", { name: "Actualitzar" }).click();
    await otherView.getByRole("button", { name: "Preparar una proposta d'acord" }).click();
    for (const [label, value] of Object.entries({
      "Objectiu compartit": "Validar BF 1-of-1",
      "Aportació proposada": "Mostra de confecció",
      "Dedicació estimada": "Dues jornades",
      "Resultat o lliurable": "Una mostra i valoració",
      "Condicions de col·laboració": "Treball de prova sintètic",
    })) {
      await otherView.getByLabel(label).fill(value);
    }
    await otherView.getByRole("button", { name: "Crear proposta privada" }).click();
    await expect(otherView.getByText(/Proposta privada registrada/)).toBeVisible();

    await ownerView.getByRole("button", { name: "Actualitzar" }).click();
    await ownerView.getByRole("button", { name: /Versió 1 · Pendent de confirmacions/ }).click();
    await expect(ownerView.getByTestId("agreement-review")).toBeVisible();
    await ownerView.getByRole("button", { name: "Confirmar exactament aquesta versió" }).click();
    await otherView.getByRole("button", { name: "Actualitzar" }).click();
    await otherView.getByRole("button", { name: /Versió 1 · Pendent de confirmacions/ }).click();
    await otherView.getByRole("button", { name: "Confirmar exactament aquesta versió" }).click();
    await expect(otherView.getByRole("button", { name: /Confirmada per ambdues parts/ })).toBeVisible();

    // #23: genuine API-backed Proof lifecycle for two participants and an outsider.
    const proofA = owner.getByTestId("inc-proof-panel");
    const proofB = collaborator.getByTestId("inc-proof-panel");
    await proofB.getByRole("button", { name: "Actualitzar Proof" }).click();
    await expect(proofB.getByLabel("Acord confirmat").locator("option")).toHaveCount(2);
    await proofB.getByLabel("Acord confirmat").selectOption({ index: 1 });
    await proofB.getByLabel("Resum de l’aportació").fill("Mostra tèxtil BF Proof");
    await proofB.getByRole("button", { name: "Declarar aportació privada" }).click();
    await expect(proofB.getByTestId("proof-detail")).toContainText("Versió 1 · Declarada");
    const records = await (await collaborator.request.get(`${origin}/api/private/proofs`)).json();
    const proof = records.find((p: {summary: string}) => p.summary === "Mostra tèxtil BF Proof");
    const proofRoot = `${origin}/api/private/proofs/${proof.id}`;

    const thirdContext = await browser.newContext({ ignoreHTTPSErrors: true });
    try {
      const third = await thirdContext.newPage();
      await login(third, "Tercer");
      await expect(third.getByTestId("inc-proof-panel")).toContainText("No hi ha aportacions accessibles.");
      for (const suffix of ["", "/evidence", "/attestations"])
        expect((await third.request.get(proofRoot + suffix)).status()).toBe(404);
      expect((await third.request.post(proofRoot + "/attestations", {
        headers: { Origin: origin }, data: {expected_version: 1, decision: "confirm", note: "Intent aliè", confirm: true},
      })).status()).toBe(404);
    } finally { await thirdContext.close(); }

    await proofA.getByRole("button", { name: "Actualitzar Proof" }).click();
    await proofA.getByRole("button", { name: /Mostra tèxtil BF Proof · v1/ }).click();
    await expect(proofA.getByLabel("Referència de la font")).toHaveCount(0);
    await expect(proofA.getByRole("button", { name: "Retirar aportació" })).toHaveCount(0);
    for (const panel of [proofA, proofB]) {
      await panel.getByLabel("Nota de revisió").fill("He revisat la mostra sintètica");
      await panel.getByRole("checkbox", { name: /He revisat la versió 1/ }).check();
      await panel.getByRole("button", { name: "Registrar decisió de Proof" }).click();
      await expect(panel.getByText("Decisió registrada per a aquesta versió.", { exact: true })).toBeVisible();
    }
    await expect(proofB.getByTestId("proof-detail")).toContainText("Versió 1 · Confirmada per ambdues parts");
    await proofB.getByLabel("Referència de la font").fill("BF-PROOF-001");
    await proofB.getByLabel("Versió de la font").fill("R1");
    await proofB.getByLabel("Procedència").fill("Mesura sintètica, sense dades de clients");
    await proofB.getByLabel("Drets d’ús declarats").fill("Només participants");
    await proofB.getByRole("button", { name: "Afegir evidència i revisar versió" }).click();
    await expect(proofB.getByTestId("proof-detail")).toContainText("Versió 2 · Declarada");
    await expect(proofB.getByTestId("proof-detail")).toContainText("Històrica, no vigent");

    // Refresh recovers the latest version; a dispute is a human decision, not certification.
    await proofA.getByRole("button", { name: "Actualitzar Proof" }).click();
    await expect(proofA.getByTestId("proof-detail")).toContainText("Versió 2 · Declarada");
    const concurrent = await collaborator.request.post(proofRoot + "/evidence", {
      headers: { Origin: origin }, data: {expected_version: 2, origin: "self", source_reference: "BF-PROOF-002", source_version: "R2", provenance: "Revisió concurrent sintètica", rights_note: "Privat"},
    });
    expect(concurrent.status()).toBe(201);
    await proofA.getByLabel("Nota de revisió").fill("Decisió sobre versió antiga");
    await proofA.getByRole("checkbox", { name: /He revisat la versió 2/ }).check();
    await proofA.getByRole("button", { name: "Registrar decisió de Proof" }).click();
    await expect(proofA.getByRole("alert")).toContainText("La versió ha canviat");
    await expect(proofA.getByTestId("proof-detail")).toContainText("Versió 3 · Declarada");
    await expect(proofA.getByRole("checkbox", { name: /He revisat la versió 3/ })).not.toBeChecked();
    await proofA.getByLabel("Decisió", { exact: true }).selectOption("dispute");
    await proofA.getByLabel("Nota de revisió").fill("Cal contrastar aquesta nova evidència");
    await proofA.getByRole("checkbox", { name: /He revisat la versió 3/ }).check();
    await proofA.getByRole("button", { name: "Registrar decisió de Proof" }).click();
    await expect(proofA.getByTestId("proof-detail")).toContainText("Versió 3 · En disputa");
    await proofB.getByRole("button", { name: "Actualitzar Proof" }).click();
    await expect(proofB.getByTestId("proof-detail")).toContainText("Versió 3 · En disputa");
    await proofB.getByLabel("Motiu de retirada").fill("Retirem la mostra per revisar-la");
    await proofB.getByRole("checkbox", { name: /Vull retirar aquesta aportació/ }).check();
    await proofB.getByRole("button", { name: "Retirar aportació" }).click();
    await expect(proofB.getByTestId("proof-detail")).toContainText("Retirada");
    await expect(proofB.getByRole("button", { name: "Registrar decisió de Proof" })).toHaveCount(0);
    await expect(proofB.getByTestId("proof-detail")).toContainText("BF-PROOF-001");

    // A late response for the old selection must not replace the new contribution.
    const second = await collaborator.request.post(`${origin}/api/private/agreements/${proof.agreement_id}/proofs`, {
      headers: { Origin: origin }, data: {kind: "knowledge", summary: "Segona aportació BF"},
    });
    expect(second.status()).toBe(201);
    await proofB.getByRole("button", { name: "Actualitzar Proof" }).click();
    await expect(proofB.getByRole("button", {name: /Segona aportació BF · v1/})).toBeVisible();
    await expect(proofB.getByTestId("proof-detail")).toContainText("Retirada");
    let release!: () => void;
    let began!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const intercepted = new Promise<void>(resolve => { began = resolve; });
    await collaborator.route(proofRoot, async route => {
      const response = await route.fetch(); began(); await gate;
      await route.fulfill({response}).catch(() => {}); // The selection change aborts this request.
    });
    await proofB.getByRole("button", { name: /Mostra tèxtil BF Proof · v4/ }).click();
    await intercepted;
    await proofB.getByRole("button", { name: /Segona aportació BF · v1/ }).click();
    await expect(proofB.getByTestId("proof-detail")).toContainText("Segona aportació BF");
    release();
    await collaborator.unroute(proofRoot);
    await expect(proofB.getByTestId("proof-detail")).not.toContainText("BF-PROOF-001");

    // Access loss removes cached details; list failures terminate loading and can recover.
    const secondId = (await second.json()).id;
    const secondRoot = `${origin}/api/private/proofs/${secondId}`;
    await collaborator.route(secondRoot, route => route.fulfill({status: 403, json: {code: "request_failed"}}));
    await proofB.getByRole("button", { name: /Segona aportació BF · v1/ }).click();
    await expect(proofB.getByRole("alert")).toContainText("Aportació no disponible");
    await expect(proofB.getByTestId("proof-detail")).toHaveCount(0);
    await collaborator.unroute(secondRoot);
    await collaborator.route(`${origin}/api/private/proofs`, route => route.fulfill({status: 503, json: {code: "service_unavailable"}}));
    await proofB.getByRole("button", { name: "Actualitzar Proof" }).click();
    await expect(proofB.getByRole("alert")).toBeVisible();
    await expect(proofB.getByText("Carregant aportacions…")).toHaveCount(0);
    await expect(proofB.getByTestId("proof-detail")).toHaveCount(0);
    await collaborator.unroute(`${origin}/api/private/proofs`);
    await proofB.getByRole("button", { name: "Actualitzar Proof" }).click();
    await expect(proofB.getByRole("button", {name: /Segona aportació BF · v1/})).toBeVisible();

    expect((await collaborator.request.get(root)).status()).toBe(404);
    expect((await (await owner.request.get(root)).json()).visibility).toBe("private");
  } finally {
    await Promise.allSettled([ownerContext.close(), collaboratorContext.close()]);
  }
});
