import { test, expect } from "@playwright/test";

test("entrance repeats, cancels travel, ignores duplicate activation and focuses destination", async ({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto("/entrada");
  const orb=page.getByRole("button",{name:"Entra a IncForStartUp amb un viatge entre estrelles"});
  await expect(page.getByRole("button",{name:"Pausa el moviment"})).toBeEnabled();
  await orb.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("button",{name:"Cancel·la el viatge"})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button",{name:"Cancel·la el viatge"})).toHaveCount(0);
  await expect(orb).toBeFocused();
  await page.waitForTimeout(1200); // Prove the cancelled navigation deadline cannot fire.
  await expect(page).toHaveURL(/\/entrada$/);
  await orb.dblclick();
  await expect(page).not.toHaveURL(/\/entrada$/);
  await expect(page.locator("main h1").first()).toBeFocused();
  await page.goBack();
  await expect(orb).toBeVisible();
  await page.getByRole("button",{name:"Pausa el moviment"}).click();
  await expect(page.getByRole("button",{name:"Activa el moviment"})).toHaveAttribute("aria-pressed","true");
  await orb.press("Space");
  await expect(page).not.toHaveURL(/\/entrada$/);
});

test("reduced motion and canvas failure preserve direct access and safe destinations", async ({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/entrada?next=https://example.org");
  await expect(page.getByRole("link",{name:"Entra directament"})).toHaveAttribute("href","/campus");
  await expect(page.getByRole("button",{name:"Moviment reduït"})).toBeDisabled();
  await page.getByRole("button",{name:"Entra a IncForStartUp amb un viatge entre estrelles"}).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});
  await page.goto("/entrada?next=/idees");
  await expect(page.getByRole("status")).toHaveText("Entrada disponible sense animació.");
  await page.getByRole("button",{name:"Entra a IncForStartUp amb un viatge entre estrelles"}).click();
  await expect(page).toHaveURL(/\/idees$/);
});

test("small landscape entrance has no horizontal overflow", async ({page})=>{
  await page.setViewportSize({width:568,height:320});
  await page.goto("/entrada");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.getByRole("link",{name:"Entra directament"})).toBeVisible();
});

test("renderer stops drawing when paused or hidden and resumes without a stale trip", async ({page})=>{
  await page.addInitScript(()=>{
    const state={draws:0,hidden:false};
    Object.defineProperty(window,"__entranceProbe",{value:state});
    Object.defineProperty(document,"hidden",{get:()=>state.hidden,configurable:true});
    const clear=CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect=function(...args){state.draws++;return clear.apply(this,args);};
  });
  const draws=()=>page.evaluate(()=>Reflect.get(window,"__entranceProbe").draws as number);
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto("/entrada");
  await expect.poll(draws).toBeGreaterThan(2);
  await page.getByRole("button",{name:"Pausa el moviment"}).click();
  await expect(page.getByRole("button",{name:"Activa el moviment"})).toBeVisible();
  await page.waitForTimeout(100);
  const paused=await draws(); await page.waitForTimeout(180); expect(await draws()).toBe(paused);
  await page.getByRole("button",{name:"Activa el moviment"}).click();
  await expect.poll(draws).toBeGreaterThan(paused);
  await page.evaluate(()=>{Reflect.get(window,"__entranceProbe").hidden=true;document.dispatchEvent(new Event("visibilitychange"));});
  const hidden=await draws(); await page.waitForTimeout(180); expect(await draws()).toBe(hidden);
  await page.evaluate(()=>{Reflect.get(window,"__entranceProbe").hidden=false;document.dispatchEvent(new Event("visibilitychange"));});
  await expect.poll(draws).toBeGreaterThan(hidden);
  await page.getByRole("button",{name:"Entra a IncForStartUp amb un viatge entre estrelles"}).click();
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(page.getByRole("button",{name:"Cancel·la el viatge"})).toHaveCount(0);
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(/\/entrada$/);
  await page.getByRole("link",{name:"Entra directament"}).click();
  await expect(page).toHaveURL(/\/demo$/);
});
