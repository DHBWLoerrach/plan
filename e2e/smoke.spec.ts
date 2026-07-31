import { expect, test, type Locator, type Page } from "@playwright/test";

const password = "Ein-sicheres-Testpasswort1!";
/** The window Better Auth counts sign-ins of one address in, plus the second it takes to expire. */
const signInWindow = 11_000;

/**
 * Signing in, with one retry. Better Auth rate limits sign-ins per address, and this file signs in more often than one
 * window allows; a rejected attempt is waited out rather than letting the tests share one session, which would tie
 * them to each other's order.
 */
async function signIn(page: Page, email: string) {
  await page.goto("/intern/anmelden");
  // The message of the form itself, not any element with the role: the development overlay carries one as well.
  const rejection = page.getByText("Die Anmeldung war nicht erfolgreich");
  await attemptSignIn(page, email, rejection);
  if (await rejection.isVisible()) {
    await page.waitForTimeout(signInWindow);
    await attemptSignIn(page, email, rejection);
  }
  await expect(page).toHaveURL(/\/intern$/u);
}

/** One attempt, filled anew each time: a rejected submission leaves the form reset, so a retry starts from empty fields. */
async function attemptSignIn(page: Page, email: string, rejection: Locator) {
  await page.getByLabel("Dienstliche E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await Promise.race([
    page.waitForURL(/\/intern$/u).catch(() => {}),
    rejection.waitFor({ state: "visible" }).catch(() => {}),
  ]);
}

test("sets a password from a link and signs in", async ({ page }) => {
  await page.goto("/intern/passwort-vergeben#e2e-password-link-token");
  await page.getByLabel("Neues Passwort").fill(password);
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(page).toHaveURL(/\/intern\/anmelden\?passwort=gesetzt$/u);

  await page.getByLabel("Dienstliche E-Mail-Adresse").fill("link@test.invalid");
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/intern$/u);
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

/**
 * The smart way into a new course, from the choice of the way to the written course progression. The course code
 * carries a four-digit year, so the proposed study period is the same one whenever this test runs.
 */
test("creates a course smartly and lands on a complete planning state", async ({ page }) => {
  await signIn(page, "editor@test.invalid");
  await page.goto("/intern/kurse/neu");
  await page.getByRole("link", { name: "Kurs smart anlegen" }).click();
  await expect(page).toHaveURL(/\/intern\/kurse\/neu\/smart$/u);

  await page.getByLabel("Kurskennung").fill("E2E2027SMART");
  await page.getByLabel("Studiengang").selectOption("program-own");
  await expect(page.getByLabel("Studienbeginn")).toHaveValue("2027-10-01");
  await expect(page.getByLabel("Studienende")).toHaveValue("2030-09-30");

  const phases = page.getByRole("listitem").filter({ hasText: /Phase \d+/u });
  await expect(phases).toHaveCount(12);
  // The theory phase at the turn of the year ends on the Sunday before 24 December.
  await expect(phases.first()).toContainText("Theoriephase");
  await expect(phases.first()).toContainText("Fr 01.10.2027 – So 19.12.2027");
  // The study end is anchored to its date, so the last phase ends on it whatever weekday it falls on.
  await expect(phases.last()).toContainText("Mo 30.09.2030");

  // The other starting phase turns the progression around and lets the first phase run past Epiphany.
  await page.getByRole("radio", { name: "Praxisphase" }).check();
  await expect(phases.first()).toContainText("Praxisphase");
  await expect(phases.first()).toContainText("Fr 01.10.2027 – So 09.01.2028");
  await page.getByRole("radio", { name: "Theoriephase" }).check();

  // A boundary moved by hand takes the following phase with it.
  await page.getByRole("button", { name: "Anpassen — Phase 2" }).click();
  await page.getByLabel("Ende", { exact: true }).fill("2028-04-09");
  await expect(phases.nth(2)).toContainText("Mo 10.04.2028");

  await page.getByRole("button", { name: "Kurs mit Studienplan anlegen" }).click();
  await expect(page.getByText("Der Kurs wurde angelegt.")).toBeVisible();
  const courseId = new URL(page.url()).pathname.split("/").pop();

  // What was written is read back where the course progression is shown: complete, and therefore publishable.
  await page.goto(`/intern/kurse/zuschnitt?year=2027&courseId=${courseId}`);
  await expect(page.getByText("Planungsstand ist vollständig.")).toBeVisible();
});

/* The overview is asserted here rather than in a test of its own: every sign-in beyond the rate limit costs the suite a
   waited-out window. This test already signs in as the editor, and what the overview shows it — the own areas and
   nothing beyond them — is the same boundary its remaining steps read from the other end. */
test("opens on the own areas and keeps foreign courses read-only, confirming with the keyboard", async ({ page }) => {
  await signIn(page, "editor@test.invalid");
  await expect(page.getByRole("heading", { name: "E2E Testinformatik" })).toBeVisible();
  /* The publishing test renames the course, so only the part of the code that survives it is matched. */
  await expect(page.getByRole("link", { name: /^TIF26/u })).toBeVisible();
  await expect(page.getByText("Fremdinformatik")).toHaveCount(0);

  await page.goto("/intern/kurse/e2e-foreign-course");
  await expect(page.getByText(/lesen, aber nicht bearbeiten/u)).toBeVisible();
  await expect(page.getByRole("button", { name: "Kurs veröffentlichen" })).toHaveCount(0);

  await page.goto("/intern/kurse/e2e-course");
  const correction = page.getByRole("button", { name: "Änderung prüfen" });
  const publication = page.getByRole("button", { name: "Kurs veröffentlichen" });
  const control = await correction.count() ? correction : publication;
  const confirmationName = await correction.count() ? "Öffentliche Kursangaben ändern" : "Diesen Kurs veröffentlichen";
  await control.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("group", { name: confirmationName })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(control).toBeFocused();
});
