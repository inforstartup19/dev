import { test, expect, type Page } from "@playwright/test";

test.skip(
  process.env.RUN_CONNECTED_E2E !== "1",
  "Requires isolated OIDC and API test services.",
);

async function login(page: Page, account: "Professor" | "Alumne") {
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
    await owner.getByLabel("Observacions").fill("Resposta de prova inconcloent.");
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
