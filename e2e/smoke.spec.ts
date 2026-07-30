import { expect, test, type Page } from "@playwright/test";

const password = "Ein-sicheres-Testpasswort1!";

async function signIn(page: Page, email: string) {
  await page.goto("/intern/anmelden");
  await page.getByLabel("Dienstliche E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/intern$/u);
}

test("sets a password from a link and signs in", async ({ page }) => {
  await page.goto("/intern/passwort-vergeben#e2e-password-link-token");
  await page.getByLabel("Neues Passwort").fill(password);
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(page).toHaveURL(/\/intern\/anmelden\?passwort=gesetzt$/u);

  await page.getByLabel("Dienstliche E-Mail-Adresse").fill("link@test.invalid");
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Übersicht" })).toBeVisible();
});

test("edits, publishes and publicly reads a course", async ({ page }) => {
  await signIn(page, "admin@test.invalid");
  await page.goto("/intern/kurse/e2e-course");
  await page.getByLabel("Kurskennung").fill("TIF26EDIT");
  await page.getByRole("button", { name: "Kursangaben speichern" }).click();
  await expect(page.getByRole("status")).toContainText("Kursangaben wurden gespeichert");
  await page.getByRole("button", { name: "Kurs veröffentlichen" }).click();
  await page.getByRole("button", { name: "Jetzt veröffentlichen" }).click();

  await page.goto("/TIF26EDIT");
  await expect(page.getByRole("heading", { name: "TIF26EDIT" })).toBeVisible();
});

test("keeps foreign courses read-only and confirms with the keyboard", async ({ page }) => {
  await signIn(page, "editor@test.invalid");
  await page.goto("/intern/kurse/e2e-foreign-course");
  await expect(page.getByText(/lesen, aber nicht bearbeiten/u)).toBeVisible();
  await expect(page.getByRole("button", { name: "Kurs veröffentlichen" })).toHaveCount(0);

  await page.goto("/intern/kurse/e2e-course");
  const publish = page.getByRole("button", { name: "Kurs veröffentlichen" });
  await publish.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("group", { name: "Diesen Kurs veröffentlichen" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(publish).toBeFocused();
});
