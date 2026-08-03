import { expect, request as playwrightRequest, test, type Locator, type Page } from "@playwright/test";

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
 * The generating way into a new course, from the choice of the way to the written course progression. The course code
 * carries a four-digit year, so the proposed study period is the same one whenever this test runs.
 */
test("creates a course with a generated progression and lands on a complete planning state", async ({ page }) => {
  await signIn(page, "editor@test.invalid");
  await page.goto("/intern/kurse/neu");
  await page.getByRole("link", { name: "Kursverlauf erzeugen" }).click();
  await expect(page).toHaveURL(/\/intern\/kurse\/neu\/erzeugt$/u);

  await page.getByLabel("Kurskennung").fill("E2E2027GEN");
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
  await page.goto(`/intern/kurse/${courseId}/plan`);
  await expect(page.getByText("Planungsstand ist vollständig.")).toBeVisible();
});

/**
 * The other way into a new course: the adoption. The choice page only offers it while a template exists that this
 * account could adopt from, so the state of the card is asserted before the way is taken — a seed whose courses no
 * longer match a study program of the editor would otherwise close the way without any test noticing.
 */
test("adopts the progression of an existing course into a new one", async ({ page }) => {
  await signIn(page, "editor@test.invalid");
  await page.goto("/intern/kurse/neu");
  const adoption = page.getByRole("listitem").filter({ hasText: "Aus Vorlage übernehmen" });
  await expect(adoption).not.toHaveAttribute("data-unavailable", /.*/u);
  await expect(adoption).toContainText("Vorlage mit gleicher Semesterzahl");
  await page.getByRole("link", { name: "Aus Vorlage übernehmen" }).click();
  await expect(page).toHaveURL(/\/intern\/kurse\/neu\/vorlage$/u);

  /* By role and accessible name, not by a CSS selector: the enclosing label carries the texts of all options in its
     own text content, so addressing it by its label matches nothing exactly — the computed name is plain "Vorlage". */
  await page.getByRole("combobox", { name: "Vorlage", exact: true }).selectOption("e2e-course");
  await page.getByRole("button", { name: "Vorlage wählen" }).click();

  await page.getByLabel("Kurskennung").fill("E2E2027ADOPT");
  await page.getByLabel("Studiengang").selectOption("program-own");
  /* A shift is rounded to whole weeks, because course phases are anchored to weekdays while a study period is anchored
     to dates. A study start exactly 52 weeks past the one of the template is where the two agree, so the adopted
     progression covers the new study period exactly instead of missing its borders by up to three days. */
  await page.getByLabel("Studienbeginn").fill("2027-09-30");
  await expect(page.getByLabel("Studienende")).toHaveValue("2030-09-29");
  await page.getByRole("button", { name: "Kurs übernehmen und anlegen" }).click();
  await expect(page.getByText("Der Kurs wurde angelegt.")).toBeVisible();
  const courseId = new URL(page.url()).pathname.split("/").pop();

  // The adopted progression is the one of the template, shifted — and complete, so the new course is publishable.
  await page.goto(`/intern/kurse/${courseId}/plan`);
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

  /* The comparison is switched inside the running page rather than loaded fresh: the matrix keeps its column
     selection across that navigation, so a course newly brought in has to arrive shown instead of hidden. The foreign
     course is the one the widened comparison adds, and no test renames it. */
  await page.goto("/intern/kurse/e2e-course/plan");
  const foreignColumn = page.getByRole("columnheader", { name: /FRM26E2E/u });
  await expect(foreignColumn).toHaveCount(0);
  await page.getByRole("link", { name: "Jahrgang", exact: true }).click();
  await expect(page).toHaveURL(/vergleich=jahrgang/u);
  await expect(foreignColumn.first()).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /FRM26E2E/u })).toBeChecked();

  /* A server action is a public endpoint: whoever holds its identifier reaches it without ever passing the page whose
     permission check would have stopped them. The captured request is therefore replayed without the session cookie,
     and must then say nothing about the course inventory. The transfer target does not exist, so the attempt is
     refused either way and leaves nothing behind — only the refusal itself differs. */
  let captured: { url: string; headers: Record<string, string>; body: string | null } | null = null;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) {
      captured = { url: request.url(), headers: request.headers(), body: request.postData() };
    }
  });
  const eventForm = page.locator("form").filter({ has: page.getByLabel("Titel") }).first();
  await eventForm.getByLabel("Titel").fill("Sondierung");
  await eventForm.getByLabel("Kategorie").selectOption("EXAM");
  await eventForm.getByLabel("Startdatum").fill("2027-05-05");
  await eventForm.evaluate((node) => {
    const smuggled = document.createElement("input");
    smuggled.type = "hidden";
    smuggled.name = "transferCourseId";
    smuggled.value = "kein-kurs";
    node.append(smuggled);
  });
  const review = eventForm.getByRole("button", { name: "Termin prüfen" });
  if (await review.count()) await review.click();
  await eventForm.getByRole("button", { name: "Termin speichern" }).click();
  // The message of the form itself: the route announcer of Next.js carries the same role.
  await expect(eventForm.getByRole("alert")).toContainText("nicht gefunden");

  expect(captured, "keine Server-Action-Anfrage aufgezeichnet").not.toBeNull();
  const { url, headers, body } = captured!;
  const anonymous = await playwrightRequest.newContext();
  const withoutSession = { ...headers };
  delete withoutSession.cookie;
  // Playwright sets the length of the body it actually sends; a copied one would contradict it.
  delete withoutSession["content-length"];
  const replay = await anonymous.post(url, { headers: withoutSession, data: body ?? "" });
  const answer = await replay.text();
  await anonymous.dispose();
  expect(answer).toContain("Ihre Sitzung ist nicht mehr gültig");
  expect(answer).not.toContain("nicht gefunden");

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
