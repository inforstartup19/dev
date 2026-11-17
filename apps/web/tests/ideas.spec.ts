import { test, expect, type Page } from "@playwright/test";

test.skip(
  process.env.RUN_CONNECTED_E2E !== "1",
  "Requires isolated OIDC and API test services.",
);

async function signIn(page: Page, account: "Professor" | "Alumne") {
  await page.goto("http://localhost:3400/idees");
  await page
    .getByRole("button", { name: "Continua amb el teu compte", exact: true })
    .click();
  await page
    .getByRole("link", { name: `${account} de proves`, exact: true })
    .click();
  await expect(page).toHaveURL(/\/idees$/);
  await expect(
    page.getByRole("heading", { name: "Una idea, moltes possibilitats." }),
  ).toBeVisible();
}

test("personal ideas persist across reload and remain invisible to another account", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const ownerContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const otherContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const owner = await ownerContext.newPage();
  const other = await otherContext.newPage();

  await signIn(owner, "Professor");
  await owner.getByLabel("Pregunta o necessitat").fill("Què necessita el barri?");
  await owner.getByRole("button", { name: "Desa al compte privat" }).click();
  await expect(
    owner.getByText("Esborrany desat al teu compte privat.", { exact: false }),
  ).toBeVisible();

  const response = await owner.request.get(
    "http://localhost:3400/api/private/idea-drafts",
  );
  expect(response.ok()).toBe(true);
  const own = await response.json();
  expect(own).toHaveLength(1);
  expect(own[0].visibility).toBe("private");
  expect(own[0].next_test).toBe("");
  const draftId = own[0].id;

  await owner.reload();
  await owner
    .getByRole("button", { name: /Què necessita el barri\?/ })
    .click();
  await expect(owner.getByLabel("Pregunta o necessitat")).toHaveValue(
    "Què necessita el barri?",
  );

  await signIn(other, "Alumne");
  await expect(other.getByText("Què necessita el barri?")).toHaveCount(0);
  const hidden = await other.request.get(
    `http://localhost:3400/api/private/idea-drafts/${draftId}`,
  );
  expect(hidden.status()).toBe(404);
  const forbidden = await other.request.post(
    `http://localhost:3400/api/private/idea-drafts/${draftId}`,
    {
      headers: { Origin: "http://localhost:3400" },
      data: { question: "Intent no autoritzat" },
    },
  );
  expect(forbidden.status()).toBe(404);
  await ownerContext.close();
  await otherContext.close();
});

test("local short drafts are previewed and explicitly copied once without deleting the original", async ({ browser }) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  try {
    await signIn(page, "Alumne");
    const sample = [{ id: "local-copy-84", question: "Una idea local per al Campus", intention: "", name: "Còpia privada #84", nextTest: "", scope: "personal-local", updatedAt: "2026-11-17T10:00:00Z" }];
    await page.evaluate(data => localStorage.setItem("incforstartup-idea-drafts-v1", JSON.stringify(data)), sample);
    await page.getByText("Porta una fitxa local al teu compte", { exact: true }).click();
    await page.getByRole("button", { name: "Revisa fitxes d’aquest navegador" }).click();
    await page.getByLabel("Fitxa a copiar").selectOption("local-copy-84");
    const copy = page.getByRole("button", { name: "Copia la fitxa al compte privat" });
    await expect(copy).toBeDisabled();
    const rows = async () => (await (await page.request.get("/api/private/idea-drafts")).json()).filter((x: { name: string }) => x.name === "Còpia privada #84");
    expect(await rows()).toHaveLength(0);
    await page.getByRole("checkbox", { name: /Confirmo la còpia privada/ }).check();
    await copy.click();
    await expect(page.getByText("Fitxa copiada al compte privat. L’original local es conserva sense canvis.")).toBeVisible();
    expect(await rows()).toHaveLength(1);
    await page.getByRole("checkbox", { name: /Confirmo la còpia privada/ }).check();
    await copy.click();
    await expect(copy).toBeDisabled();
    expect(await rows()).toHaveLength(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("incforstartup-idea-drafts-v1")!))).toEqual(sample);
  } finally { await context.close(); }
});
