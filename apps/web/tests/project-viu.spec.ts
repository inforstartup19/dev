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
  test.setTimeout(120000);
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
    await owner.getByLabel("Decisió", { exact: true }).selectOption("reformulate");
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
    await ownerContext.close();
    await strangerContext.close();
  }
});
