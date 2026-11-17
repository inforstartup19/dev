import { test, expect } from "@playwright/test";

test("approved entry opens four spheres, keyboard focus follows and workspaces can return", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/entrada");
  await expect(page.getByRole("button", { name: /Pausa/ })).toHaveCount(0);
  const orb = page.getByRole("button", { name: "Entra a IncForStartUp amb un viatge entre estrelles" });
  await orb.focus(); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/univers$/);
  await expect(page.getByRole("heading", { name: "Tria el teu espai a Quelcom" })).toBeFocused();
  await expect(page.getByRole("navigation", { name: "Tria el teu espai", exact: true }).getByRole("link")).toHaveCount(4);
  await page.getByRole("link", { name: /^Startup:/ }).click();
  await expect(page.getByRole("heading", { name: "Dona continuïtat al que has començat." })).toBeFocused();
  await page.getByRole("link", { name: "Els quatre espais" }).click();
  await page.getByRole("link", { name: /^Campus:/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("link", { name: "Els quatre espais" })).toBeVisible();
});

test("canvas fallback and mobile grids retain usable entry and no horizontal overflow", async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/entrada");
  await expect(page.getByText("quelcom", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Entra a IncForStartUp/ }).click();
  for (const width of [320, 393, 430, 1280]) {
    await page.setViewportSize({ width, height: 852 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("link", { name: /^Campus:/ })).toBeVisible();
  }
});

test("local drafts refuse stale writes and allow exporting pending fields", async ({ page, context }) => {
  await page.goto("/idees");
  await page.getByLabel("Pregunta o necessitat").fill("Text pendent de la primera pestanya");
  const second = await context.newPage(); await second.goto("/idees");
  await second.getByLabel("Pregunta o necessitat").fill("Idea desada des de la segona pestanya");
  await second.getByRole("button", { name: "Desa l'esborrany", exact: true }).click();
  await page.getByRole("button", { name: "Desa l'esborrany", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Una altra pestanya" })).toBeVisible();
  await expect(page.getByLabel("Pregunta o necessitat")).toHaveValue("Text pendent de la primera pestanya");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporta una còpia dels camps" }).click();
  expect((await download).suggestedFilename()).toBe("quelcom-camps-pendents.json");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("link", { name: "Els quatre espais" }).click();
  await expect(page).toHaveURL(/\/idees$/);
});
