import { expect, test, type Page } from "@playwright/test";

test.skip(
  process.env.RUN_CONNECTED_E2E !== "1",
  "Requires the isolated authenticated Campus + Projecte Viu fixture.",
);

async function login(page: Page) {
  await page.goto("http://localhost:3400/idees");
  await page.getByRole("button", {
    name: "Continua amb el teu compte",
    exact: true,
  }).click();
  await page.getByRole("link", {
    name: "Professor de proves",
    exact: true,
  }).click();
  await expect(page).toHaveURL(/\/idees$/);
}

test("BF mobile viewport preserves lifecycle controls and keyboard navigation", async ({
  browser,
}) => {
  test.setTimeout(150000);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  try {
    await login(page);
    await page.getByLabel("Pregunta o necessitat").fill("BF: revisió responsive?");
    await page.getByLabel("Nom provisional").fill("BF — Mobile QA");
    await page.getByRole("button", { name: "Desa al compte privat" }).click();
    const panel = page.getByTestId("project-lifecycle");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("lifecycle-state")).toContainText("Actiu");

    await page.getByLabel("Acció operativa").focus();
    await expect(page.getByLabel("Acció operativa")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(panel.getByLabel("Justificació operativa")).toBeFocused();

    for (const width of [390, 820]) {
      await page.setViewportSize({ width, height: 844 });
      await expect.poll(() => page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      )).toBe(true);
      await expect(panel.getByRole("button", { name: "Pausar operativament" }))
        .toBeVisible();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await panel.getByLabel("Justificació operativa")
      .fill("Pausa per revisar el pilot BF.");
    await panel.getByLabel("Observacions de la revisió")
      .fill("Proves, participants i acords revisats manualment.");
    await panel.getByLabel("Condicions de represa")
      .fill("Revisió d'un responsable abans de reprendre.");
    for (const checkbox of await panel.getByRole("checkbox").all()) {
      await checkbox.check();
    }
    await panel.getByRole("button", { name: "Pausar operativament" }).click();
    await expect(page.getByTestId("lifecycle-state")).toContainText("Pausat");
    await expect(panel.getByText(/Noves proves, activacions/)).toBeVisible();
  } finally {
    await ctx.close();
  }
});
