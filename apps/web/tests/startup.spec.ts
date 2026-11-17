import { test, expect } from "@playwright/test";

test("Startup opens both pathways and optional funding without enrollment", async ({ page }) => {
  await page.goto("/startup");
  await expect(page.getByRole("heading", { name: "Dona continuïtat al que has començat." })).toBeVisible();
  await page.getByLabel("He contrastat una necessitat amb el públic").check();
  await page.getByLabel("Tinc un MVP o una primera versió provada").check();
  await page.getByLabel("Puc aportar evidències d’ús o resultats").check();
  await page.getByRole("button", { name: "Orienta el meu recorregut" }).click();
  await expect(page.getByRole("status")).toContainText("no és una admissió");
  await page.getByRole("link", { name: "Explora aquest itinerari" }).click();
  await expect(page.getByRole("heading", { name: "Enlaira", exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Etapes de Enlaira" }).getByRole("link").nth(3).click();
  await expect(page.getByText("Buscar inversors no és un requisit", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Els quatre espais" })).toHaveAttribute("href", "/univers");
});

test("mobile stage navigation fits and campus continuity keeps academic review separate", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/startup?track=crea-i-creix&step=mvp");
  await expect(page.getByRole("heading", { name: "Construeix i prova l’MVP" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole("link", { name: "Des del Campus", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Separa les revisions" })).toBeVisible();
  await expect(page.getByText("aquesta pantalla no trasllada documents", { exact: false })).toBeVisible();
});
