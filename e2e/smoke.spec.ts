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
  await expect(page).toHaveURL(/\/intern\/heute$/u);
}

/** One attempt, filled anew each time: a rejected submission leaves the form reset, so a retry starts from empty fields. */
async function attemptSignIn(page: Page, email: string, rejection: Locator) {
  await page.getByLabel("Dienstliche E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await Promise.race([
    page.waitForURL(/\/intern\/heute$/u).catch(() => {}),
    rejection.waitFor({ state: "visible" }).catch(() => {}),
  ]);
}

test("sets a password from a link and signs in", async ({ page }) => {
  await page.goto("/intern/passwort-vergeben#e2e-password-link-token");
  const newPassword = page.getByLabel("Neues Passwort", { exact: true });
  await newPassword.fill(password);
  // Showing the password keeps focus and caret in the field, and the field still submits.
  await page.getByRole("button", { name: "Neues Passwort anzeigen" }).click();
  await expect(newPassword).toHaveAttribute("type", "text");
  await expect(newPassword).toBeFocused();
  await expect(page.getByRole("button", { name: "Neues Passwort anzeigen" })).toHaveAttribute("aria-pressed", "true");
  // The toggle sits beside the field, far enough apart that it never covers the field's focus ring.
  const ringReach = await newPassword.evaluate((field) => {
    const style = getComputedStyle(field);
    return Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
  });
  const fieldBox = (await newPassword.boundingBox())!;
  const toggleBox = (await page.getByRole("button", { name: "Neues Passwort anzeigen" }).boundingBox())!;
  expect(toggleBox.x - (fieldBox.x + fieldBox.width)).toBeGreaterThanOrEqual(ringReach);
  // In a dark forced-colors theme the pressed toggle keeps its own colors, and its focus ring the system's text color.
  await newPassword.focus();
  await page.keyboard.press("Tab");
  await page.emulateMedia({ forcedColors: "active", colorScheme: "dark" });
  await expectSystemFocusRing(page, page.getByRole("button", { name: "Neues Passwort anzeigen" }));
  await page.emulateMedia({ forcedColors: "none", colorScheme: null });
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(page).toHaveURL(/\/intern\/anmelden\?passwort=gesetzt$/u);

  await page.getByLabel("Dienstliche E-Mail-Adresse").fill("link@test.invalid");
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/intern\/heute$/u);
});

/** The focus ring a control draws, read whole: a color alone is computed even where no ring is drawn. */
function focusRing(locator: Locator): Promise<{ focusVisible: boolean; style: string; width: number; color: string }> {
  return locator.evaluate((element) => {
    const { outlineStyle, outlineWidth, outlineColor } = getComputedStyle(element);
    return { focusVisible: element.matches(":focus-visible"), style: outlineStyle, width: Number.parseFloat(outlineWidth), color: outlineColor };
  });
}

/** A ring that is drawn, in the system's text color. */
async function expectSystemFocusRing(page: Page, locator: Locator) {
  const ring = await focusRing(locator);
  expect(ring.focusVisible).toBe(true);
  expect(ring.style).not.toBe("none");
  expect(ring.width).toBeGreaterThan(0);
  expect(ring.color).toBe(await canvasTextColor(page));
}

/** The system's text color in the current color mode, as the browser resolves it. */
function canvasTextColor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement("span"));
    probe.style.color = "CanvasText";
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
}

/** The disclosure an entry or a form rests behind, addressed by its summary line. */
function disclosure(page: Page, summary: string): Locator {
  return page.locator("summary").filter({ hasText: summary });
}

test("edits, publishes and publicly reads a course", async ({ page }) => {
  await signIn(page, "admin@test.invalid");
  const area = page.getByRole("combobox", { name: "Bereich", exact: true });
  const showArea = page.getByRole("button", { name: "Anzeigen" });
  const ownCourse = page.getByRole("link", { name: "TIF26E2E", exact: true });
  const foreignCourse = page.getByRole("link", { name: "FRM26E2E" });
  const finishedCourse = page.getByRole("link", { name: "FRM20E2E1", exact: true });
  const foreignArea = area.getByRole("option", { name: /^Fremder Bereich \(\d+ Kurse\)$/u });

  await test.step("start with all areas on Today and remember a selected area", async () => {
    await expect(area.locator("option:checked")).toHaveText("Alle Bereiche");
    await expect(foreignArea).toHaveCount(1);
    await expect(ownCourse).toBeVisible();
    await expect(foreignCourse).toBeVisible();
    await expect(finishedCourse).toHaveCount(0);

    await area.selectOption("area-foreign");
    await showArea.click();
    await expect(ownCourse).toHaveCount(0);
    await expect(foreignCourse).toBeVisible();
    await page.reload();
    await expect(area).toHaveValue("area-foreign");
    await expect(ownCourse).toHaveCount(0);
  });

  await test.step("select and remember the area of a large course overview", async () => {
    await page.goto("/intern");

    await expect(area, "The seeded course count should enable the area picker").toHaveValue("");
    await expect(area).toHaveAccessibleDescription("Die Kurskacheln erscheinen nach der Bereichsauswahl.");
    await expect(foreignArea).toHaveCount(1);
    await expect(ownCourse).toHaveCount(0);
    await expect(foreignCourse).toHaveCount(0);

    await area.selectOption("area-foreign");
    await showArea.press("Enter");
    await expect(foreignCourse).toBeVisible();
    await expect(finishedCourse).toBeVisible();
    await expect(ownCourse).toHaveCount(0);
    await page.reload();
    await expect(area).toHaveValue("area-foreign");
    await expect(foreignCourse).toBeVisible();

    await area.selectOption("area-own");
    await showArea.click();
    await expect(ownCourse).toBeVisible();
    await expect(foreignCourse).toHaveCount(0);
    await page.getByRole("link", { name: "Alle Kurse", exact: true }).click();
    await expect(page).toHaveURL(/\/intern\/kurse$/u);
    await expect(page.getByRole("checkbox", { name: "Kurse anderer Bereiche einbeziehen" })).not.toBeChecked();
    await expect(ownCourse).toBeVisible();
    await expect(foreignCourse).toBeVisible();
  });

  await test.step("restore all areas on Today independently of the overview", async () => {
    await page.goto("/intern/heute");
    await expect(area).toHaveValue("area-foreign");
    await expect(ownCourse).toHaveCount(0);

    await area.selectOption({ label: "Alle Bereiche" });
    await showArea.click();
    await expect(ownCourse).toBeVisible();
    await expect(foreignCourse).toBeVisible();
    await page.reload();
    await expect(area.locator("option:checked")).toHaveText("Alle Bereiche");
    await expect(ownCourse).toBeVisible();
  });

  await page.goto("/intern/kurse/e2e-course");
  // The course details rest closed, so the page opens as a plan and not as a stack of forms.
  await expect(page.getByLabel("Kurskennung")).not.toBeVisible();
  await disclosure(page, "Kursangaben ändern").click();
  await page.getByLabel("Kurskennung").fill("TIF26EDIT");
  await page.getByRole("button", { name: "Kursangaben speichern" }).click();
  await expect(page.getByText("Die Kursangaben wurden gespeichert.")).toBeVisible();
  await page.getByRole("button", { name: "Kurs veröffentlichen" }).click();
  await page.getByRole("button", { name: "Jetzt veröffentlichen" }).click();

  await page.goto("/");
  await page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" }).fill("TIF26");
  await expect(page).toHaveURL(/\/\?q=TIF26$/u);
  await page.getByRole("table").getByRole("link", { name: "TIF26EDIT" }).click();
  await expect(page).toHaveURL(/\/TIF26EDIT$/u);
  await expect(page.getByRole("heading", { name: "TIF26EDIT" })).toBeVisible();

  // Back from the plan, the overview shows the search it left, not the one it was first loaded with.
  await page.goBack();
  await expect(page).toHaveURL(/\/\?q=TIF26$/u);
  await expect(page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" })).toHaveValue("TIF26");
  await expect(page.getByRole("table").getByRole("link", { name: "TIF26EDIT" })).toBeVisible();

  // A hit opened right after typing, before the address has followed: the plan stays open, and back finds the search.
  await page.goto("/");
  await page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" }).fill("TIF26");
  await page.getByRole("table").getByRole("link", { name: "TIF26EDIT" }).click();
  await expect(page).toHaveURL(/\/TIF26EDIT$/u);
  await expect(page.getByRole("heading", { name: "TIF26EDIT" })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/TIF26EDIT$/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/\?q=TIF26$/u);
  await expect(page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" })).toHaveValue("TIF26");

  // The logo right after typing, while the address still reads „/“, empties the search all the same.
  await page.goto("/");
  await page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" }).fill("TIF26");
  await page.getByRole("link", { name: /Startseite/u }).click();
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" })).toHaveValue("");

  // From one search, another typed and the logo followed at once: back returns to the second search, field and table alike.
  await page.goto("/?q=TIF");
  await page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" }).fill("TIF26");
  await page.getByRole("link", { name: /Startseite/u }).click();
  await expect(page).toHaveURL(/\/$/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/\?q=TIF26$/u);
  await expect(page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" })).toHaveValue("TIF26");
  await expect(page.getByRole("table").getByRole("link", { name: "TIF26EDIT" })).toBeVisible();

  // A search cleared before a plan opens stays cleared on the way back, though the page was first loaded with it.
  await page.goto("/?q=TIF26");
  await page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" }).fill("");
  await expect(page).toHaveURL(/\/$/u);
  await page.getByRole("table").getByRole("link", { name: "TIF26EDIT" }).click();
  await expect(page).toHaveURL(/\/TIF26EDIT$/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" })).toHaveValue("");

  // Back right after typing goes to the previous entry as it was: the pending address does not overwrite it.
  await page.goto("/?q=TIF");
  await page.getByRole("link", { name: /Startseite/u }).click();
  await expect(page).toHaveURL(/\/$/u);
  await page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" }).fill("TIF");
  await expect(page).toHaveURL(/\/\?q=TIF$/u);
  await page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" }).fill("TIF26");
  await page.goBack();
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/\?q=TIF$/u);
  await expect(page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" })).toHaveValue("TIF");

  // The jump to the content right after typing keeps the search: it moves within the page and goes nowhere.
  await page.goto("/");
  await page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" }).fill("TIF26");
  await page.getByRole("link", { name: "Zum Inhalt springen" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await expect(page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" })).toHaveValue("TIF26");
  await expect(page).toHaveURL(/\/\?q=TIF26$/u);

  // Back to an entry a fragment link made earlier brings that entry's search back, as any other step back does.
  await page.goto("/?q=TIF");
  await page.getByRole("link", { name: "Zum Inhalt springen" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/\?q=TIF#inhalt$/u);
  await page.getByRole("link", { name: /Startseite/u }).click();
  await expect(page).toHaveURL(/\/$/u);
  await page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" }).fill("TIF26");
  await expect(page).toHaveURL(/\/\?q=TIF26$/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/\?q=TIF#inhalt$/u);
  await expect(page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" })).toHaveValue("TIF");

  // The same plan by keyboard alone: a course suggestion chosen with the arrow keys opens on Enter, even while the plan
  // takes a second to answer, and no address written meanwhile stops the router on its way.
  await page.route(/\/TIF26EDIT/u, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Studiengang oder Kurs suchen" });
  await search.fill("tif26");
  const suggestion = page.getByRole("option", { name: /TIF26EDIT/u });
  await expect(suggestion).toBeVisible();
  while (await suggestion.getAttribute("data-highlighted") === null) await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/TIF26EDIT$/u);
  await expect(page.getByRole("heading", { name: "TIF26EDIT" })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/TIF26EDIT$/u);
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
  const adjust = page.getByRole("button", { name: "Anpassen — Phase 2" });
  await expect(adjust).toHaveAttribute("type", "button");
  await expect(adjust).toHaveAttribute("aria-expanded", "false");
  await adjust.click();
  const done = page.getByRole("button", { name: "Fertig — Phase 2" });
  await expect(done).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(`#${await done.getAttribute("aria-controls")}`).getByLabel("Ende", { exact: true })).toBeVisible();
  await page.getByLabel("Ende", { exact: true }).fill("2028-04-09");
  await expect(phases.nth(2)).toContainText("Mo 10.04.2028");

  await page.getByRole("button", { name: "Kurs mit Studienplan anlegen" }).click();
  await expect(page.getByText("Der Kurs wurde angelegt.")).toBeVisible();
  const courseId = new URL(page.url()).pathname.split("/").pop();

  // What was written is read back under the plain course address: complete, and therefore publishable.
  await page.goto(`/intern/kurse/${courseId}`);
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
  /* A study year begins on 1 October. The shift is rounded to whole weeks, because course phases are anchored to
     weekdays, and would leave the progression one day beside the new study period — its first and last day are put
     back on the borders they were anchored to, so the adopted progression covers the study period exactly. */
  await page.getByLabel("Studienbeginn").fill("2027-10-01");
  await expect(page.getByLabel("Studienende")).toHaveValue("2030-09-30");
  await expect(page.getByRole("status")).toContainText("beginnt die erste Kursphase am Studienbeginn und endet die letzte Kursphase am Studienende");
  await page.getByRole("button", { name: "Kurs übernehmen und anlegen" }).click();
  await expect(page.getByText("Der Kurs wurde angelegt.")).toBeVisible();
  const courseId = new URL(page.url()).pathname.split("/").pop();

  // The adopted progression is the one of the template, shifted — and complete, so the new course is publishable.
  await page.goto(`/intern/kurse/${courseId}`);
  await expect(page.getByText("Planungsstand ist vollständig.")).toBeVisible();
});

/* The day page and the overview are asserted here rather than in tests of their own: every sign-in beyond the rate
   limit costs the suite a waited-out window. This test already signs in as the editor, and what both pages show it —
   the own areas and nothing beyond them — is the same boundary its remaining steps read from the other end. */
test("opens on the own areas and keeps foreign courses read-only, confirming with the keyboard", async ({ page }) => {
  await signIn(page, "editor@test.invalid");
  await expect(page.getByRole("heading", { level: 1, name: "Heute" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Heute" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("combobox", { name: "Bereich", exact: true })).toHaveCount(0);
  const dayRow = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: /^TIF26/u }) });
  await expect(dayRow.getByRole("link")).toHaveAttribute("href", "/intern/kurse/e2e-course?kalender=woche");
  /* The seeded course code is no DHBW calendar name, so its row settles on the not-found state without a request
     leaving the suite — what is asserted is that the row resolves rather than staying on its loading line. */
  await expect(dayRow.getByText("Kein Vorlesungskalender gefunden.")).toBeVisible();
  await expect(page.getByText("FRM26E2E")).toHaveCount(0);

  await page.getByRole("link", { name: "Übersicht" }).first().click();
  await expect(page).toHaveURL(/\/intern$/u);
  await expect(page.getByRole("combobox", { name: "Bereich", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "E2E Testinformatik" })).toBeVisible();
  /* The publishing test renames the course, so only the part of the code that survives it is matched. */
  await expect(page.getByRole("link", { name: /^TIF26/u })).toBeVisible();
  await expect(page.getByText("Fremdinformatik")).toHaveCount(0);

  /* The list opens on the courses this account is responsible for, and the foreign ones are asked for. The way is
     walked rather than typed, so the one address the row offers is the one the assertions below arrive through — a
     course has exactly one internal address, whether it may be written to or not. */
  await page.goto("/intern/kurse");
  const widerAreas = page.getByRole("checkbox", { name: "Kurse anderer Bereiche einbeziehen" });
  const resetFilters = page.getByRole("button", { name: "Alle Filter zurücksetzen" });
  await expect(resetFilters).toHaveCount(0);
  await expect(page.getByRole("link", { name: "FRM26E2E" })).toHaveCount(0);
  await widerAreas.check();
  await expect(page).toHaveURL(/zustaendigkeit=alle/u);
  const widerAreasChip = page.getByRole("button", { name: "Filter Kurse anderer Bereiche entfernen" });
  await expect(widerAreasChip).toBeVisible();
  await expect(resetFilters).toBeVisible();
  await widerAreasChip.click();
  // The form unticks at once; the address follows with a navigation that has to settle before the next change.
  await expect(page).not.toHaveURL(/zustaendigkeit/u);
  await expect(widerAreas).not.toBeChecked();
  await expect(resetFilters).toHaveCount(0);
  await widerAreas.check();

  /* An address the form did not write has to arrive in the form: the way out of an empty result sets the
     responsibility, the back key takes it away again. The list beneath stands on the address either way — what is
     asserted here is that the controls above it say the same thing, instead of claiming a narrowing that is gone. */
  await page.goto("/intern/kurse?program=program-foreign");
  await expect(widerAreas).not.toBeChecked();
  await page.getByRole("link", { name: "Auch Kurse anderer Bereiche anzeigen" }).click();
  await expect(widerAreas).toBeChecked();
  // The study program came along, so the way out widens the responsibility without emptying the rest.
  await expect(page.locator("select[name='program']")).toHaveValue("program-foreign");
  await page.goBack();
  await expect(widerAreas).not.toBeChecked();
  await expect(page.locator("select[name='program']")).toHaveValue("program-foreign");

  await page.goto("/intern/kurse?zustaendigkeit=alle");
  await page.getByRole("link", { name: "FRM26E2E" }).click();
  await expect(page).toHaveURL(/\/intern\/kurse\/e2e-foreign-course$/u);
  await expect(page.getByText(/lesen, aber nicht bearbeiten/u)).toBeVisible();
  await expect(page.getByRole("button", { name: "Kurs veröffentlichen" })).toHaveCount(0);
  // Nothing that writes: the plan is a presentation here and no line of it offers a way into a form.
  await expect(page.locator("[data-entry]")).toHaveCount(0);
  await expect(disclosure(page, "Termin erfassen")).toHaveCount(0);
  await expect(disclosure(page, "Kursangaben ändern")).toHaveCount(0);

  /* The comparison is a view of its own, reached from the planning state. Its width is switched inside the running
     page rather than loaded fresh: the matrix keeps its column selection across that navigation, so a course newly
     brought in has to arrive shown instead of hidden. The foreign course is the one the widened comparison adds, and
     no test renames it. */
  await page.goto("/intern/kurse/e2e-course");
  await page.getByRole("navigation", { name: "Kursansicht" }).getByRole("link", { name: "Vergleich" }).click();
  await expect(page).toHaveURL(/vergleich=studiengang/u);
  // Side by side the courses are only read: nothing here opens a form.
  await expect(page.locator("[data-entry]")).toHaveCount(0);
  const foreignColumn = page.getByRole("columnheader", { name: /FRM26E2E/u });
  await expect(foreignColumn).toHaveCount(0);
  await page.getByRole("link", { name: "Jahrgang", exact: true }).click();
  await expect(page).toHaveURL(/vergleich=jahrgang/u);
  await expect(foreignColumn.first()).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /FRM26E2E/u })).toBeChecked();
  // The edited course refuses to be hidden, stays ticked and says why, again on a second attempt. An earlier test
  // renames it, so it is found by being the one that refuses.
  const ownCourse = page.locator(".course-filter").getByRole("checkbox", { name: /^TIF26/u }).and(page.locator("[aria-disabled=true]"));
  // Playwright treats aria-disabled as disabled and would wait for it to clear; the checkbox is meant to be pressed.
  await ownCourse.click({ force: true });
  await expect(ownCourse).toBeChecked();
  await ownCourse.press("Space");
  await ownCourse.press("Space");
  await expect(ownCourse).toBeChecked();
  await expect(ownCourse).toBeFocused();
  await expect(page.getByText(/^TIF26\w+ bleibt sichtbar: Der bearbeitete Kurs wird in der Planmatrix immer angezeigt\.$/u)).toBeAttached();
  await page.goto("/intern/kurse/e2e-course");

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
  await disclosure(page, "Termin erfassen").click();
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
  await disclosure(page, "Kursangaben ändern").click();
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

/**
 * Saves a form whose button depends on the state of its course: a plain save where nothing public is touched, a
 * review followed by a confirmation where it is. The review button submits on its own when there is nothing to
 * confirm. A confirmation once opened stays open, and confirming it after the inputs changed only renews the preview
 * and asks again — so a form saved twice without being reopened is confirmed a second time.
 */
async function save(form: Locator, reviewName: string, plain: string, confirmation: string) {
  const confirm = form.getByRole("button", { name: confirmation });
  const review = form.getByRole("button", { name: reviewName });
  if (await review.count()) {
    await review.click();
    if (await confirm.isVisible()) await confirm.click();
  } else if (confirmation !== plain && await confirm.count()) {
    await confirm.click();
    if (await form.getByText("Die Eingaben haben sich nach der Vorschau geändert.").count()) await confirm.click();
  } else {
    await form.getByRole("button", { name: plain }).click();
  }
}

/* The plan is one list, and each of its lines is the way into editing it: the form opens directly below the line and
   takes focus, and closing it leads back to the line. The change between two phases is moved as one day, which is
   moved back again; the date is captured, changed and deleted — so the course is left as it was found. */
test("edits a change, a phase and a date from the lines of the plan", async ({ page }) => {
  await signIn(page, "admin@test.invalid");
  await page.goto("/intern/kurse/e2e-course");

  const phaseLine = page.getByRole("button", { name: /Kursphase bearbeiten$/u }).first();
  await phaseLine.click();
  const phasePanel = page.getByRole("region", { name: /^Kursphase bearbeiten/u });
  await expect(phasePanel).toBeFocused();
  await expect(phaseLine).toHaveAttribute("aria-expanded", "true");
  await phasePanel.getByRole("button", { name: "Schließen" }).click();
  await expect(phasePanel).toHaveCount(0);
  await expect(phaseLine).toBeFocused();

  /* The period of a phase between two changes rests closed inside its form. A day emptied there and closed away again
     must not block saving out of sight: the section opens and the browser points at the field. */
  await page.getByRole("button", { name: /Kursphase bearbeiten$/u }).nth(1).click();
  const period = phasePanel.locator("details").filter({ hasText: "Zeitraum ändern" });
  await expect(period).not.toHaveAttribute("open");
  await period.locator("summary").click();
  await phasePanel.getByLabel("Startdatum").fill("");
  await period.locator("summary").click();
  await expect(period).not.toHaveAttribute("open");
  await save(phasePanel.locator("form").first(), "Kursphase prüfen", "Kursphase speichern", "Änderung speichern und veröffentlichen");
  await expect(period).toHaveAttribute("open");
  await expect(phasePanel.getByLabel("Startdatum")).toBeFocused();
  await expect(phasePanel.getByRole("status")).toHaveCount(0);
  await phasePanel.getByRole("button", { name: "Schließen" }).click();

  /* Whoever aims at the dates of a phase means to change the dates: opened by its period, the form arrives with the
     period laid open — and a form that is open already stays open. The control covers the whole line, so the pointer
     is set down on the period rather than a locator clicked through the layer above it. */
  const periodBox = (await page.locator(".plan-phase > .plan-line > .plan-line__when").nth(1).boundingBox())!;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.mouse.click(periodBox.x + 20, periodBox.y + periodBox.height / 2);
    await expect(phasePanel).toBeVisible();
    await expect(period).toHaveAttribute("open");
  }
  await expect(phasePanel.getByText("Den Wechsel zur Nachbarphase verschieben Sie")).toBeVisible();
  await phasePanel.getByRole("button", { name: "Schließen" }).click();
  await expect(page.getByText("Gepunktet unterstrichene Angaben lassen sich bearbeiten.")).toBeVisible();

  /* The form is opened anew for every save and what it then offers is read after a reload: a message left over from
     an earlier save and the value just typed would both be there whether or not anything was stored. */
  const changePanel = page.getByRole("region", { name: /^Wechsel verschieben/u });
  const day = changePanel.getByLabel(/^Erster Tag der folgenden Kursphase/u);
  const openChange = async () => {
    await page.getByRole("button", { name: /Wechsel von \S+ zu \S+ verschieben$/u }).first().click();
    await expect(changePanel).toBeFocused();
  };
  await openChange();
  const original = await day.inputValue();
  const [year, month, date] = original.split("-").map(Number);
  const moved = new Date(Date.UTC(year, month - 1, date + 7)).toISOString().slice(0, 10);
  for (const value of [moved, original]) {
    await day.fill(value);
    await save(changePanel.locator("form"), "Wechsel prüfen", "Wechsel speichern", "Änderung speichern und veröffentlichen");
    await expect(changePanel.getByRole("status")).toContainText("gespeichert");
    await page.reload();
    // Both phases moved together: the plan names one day of change and reports neither a gap nor an overlap.
    await expect(page.getByText(/^(Lücke|Überschneidung):/u)).toHaveCount(0);
    await openChange();
    await expect(day).toHaveValue(value);
  }
  await changePanel.getByRole("button", { name: "Schließen" }).click();

  await disclosure(page, "Termin erfassen").click();
  const createForm = page.locator("details").filter({ hasText: "Termin erfassen" }).locator("form");
  await createForm.getByLabel("Titel").fill("Listentermin");
  await createForm.getByLabel("Kategorie").selectOption("EXAM");
  await createForm.getByLabel("Startdatum").fill("2027-05-06");
  await save(createForm, "Termin prüfen", "Termin speichern", "Termin speichern");
  await expect(createForm.getByRole("status")).toContainText("gespeichert");

  await page.getByRole("button", { name: /^Listentermin\b.*Termin bearbeiten$/u }).click();
  const eventPanel = page.getByRole("region", { name: /^Termin bearbeiten/u });
  await expect(eventPanel).toBeFocused();
  const editForm = eventPanel.locator("form").first();
  await editForm.getByLabel("Titel").fill("Listentermin geändert");
  await save(editForm, "Termin prüfen", "Termin speichern", "Änderung speichern und veröffentlichen");
  await expect(editForm.getByRole("status")).toContainText("gespeichert");
  // The form stays open on the entry it was opened for and names it by its new title.
  await expect(eventPanel).toHaveAccessibleName(/Listentermin geändert/u);

  await eventPanel.getByRole("button", { name: "Termin löschen" }).click();
  await eventPanel.getByRole("button", { name: "Endgültig löschen" }).click();
  await expect(page.getByText("Der Termin wurde gelöscht.")).toBeFocused();
  await expect(page.getByText("Listentermin geändert")).toHaveCount(0);

  /* The yearly case in one step: the planning state leads straight into an adoption of this course, with code, study
     program and study period proposed for the following year. Nothing is created here — the adoption itself has its
     own test. */
  /* The code is read from the page rather than assumed: another test renames this course, and this one has to hold
     whether or not that one ran before it. */
  const code = (await page.getByRole("heading", { level: 1 }).innerText()).replace(/^Kurs /u, "");
  expect(code).toMatch(/^TIF26/u);
  await page.getByRole("link", { name: "Für nächsten Jahrgang übernehmen" }).click();
  await expect(page).toHaveURL(/\/intern\/kurse\/neu\/vorlage\?vorlage=e2e-course&jahrgang=naechster$/u);
  await expect(page.getByLabel("Kurskennung")).toHaveValue(code.replace("TIF26", "TIF27"));
  await expect(page.getByLabel("Studiengang")).toHaveValue("program-own");
  await expect(page.getByLabel("Studienbeginn")).toHaveValue("2027-10-01");
  await expect(page.getByLabel("Studienende")).toHaveValue("2030-09-30");
  await expect(page.getByRole("status")).toContainText("um 52 Wochen nach später");
  await page.goto("/intern/kurse/e2e-course");

  /* At 320 CSS pixels the plan and an open form stay within the display: nothing makes the page itself scroll
     sideways (BARRIEREFREIHEIT.md). */
  await page.setViewportSize({ width: 320, height: 700 });
  await page.reload();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: /Kursphase bearbeiten$/u }).nth(1).click();
  await expect(phasePanel).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

/* The course code is the one filter that reaches its address late: it waits out a typing pause, so between the
   keystroke and the navigation it triggers, the field is ahead of the address on purpose. Every other filter takes
   its value back from the address once the list has been read anew, and this one must not — an answer to what was
   typed a moment ago would otherwise overwrite what is standing in the field now.
   The answer is held back here rather than merely delayed, because a delayed one is overtaken by the next navigation
   and never reaches the field at all: the moment this guards against is exactly the one where it does. */
test("keeps the typed course code against an answer that arrives late", async ({ page }) => {
  await signIn(page, "editor@test.invalid");
  await page.goto("/intern/kurse?zustaendigkeit=alle");

  let release: (() => void) | null = null;
  await page.route(/\/intern\/kurse/u, async (route) => {
    const url = route.request().url();
    if (!release && /code=frm(&|$)/u.test(url)) await new Promise<void>((resolve) => { release = resolve; });
    await route.continue();
  });

  const codeField = page.getByRole("searchbox");
  await codeField.pressSequentially("frm", { delay: 30 });
  await expect.poll(() => release !== null, { timeout: 5_000 }).toBe(true);
  await codeField.pressSequentially("26");
  await expect(codeField).toHaveValue("frm26");
  release!();

  /* Every value the field takes on from here. The answer to „frm“ is caught up by the second navigation, so a
     momentary fall back to it would not show in a reading taken at the end. */
  const seen = new Set<string>();
  const until = Date.now() + 1_000;
  while (Date.now() < until) {
    seen.add(await codeField.inputValue());
    await page.waitForTimeout(25);
  }
  expect([...seen]).toEqual(["frm26"]);
  await expect(page).toHaveURL(/code=frm26/u);
  await expect(page.getByRole("link", { name: "FRM26E2E" })).toBeVisible();
});

/* The calendar reads one period at a time, and the period asked for last is the one it must end up showing. Address,
   controls and heading follow the opened period immediately; if the request it triggers were dropped because an
   earlier one was still running, the entries beneath them would stay with the period that has just been left — and
   because both ends cut the entries down to the visible period, what stood there would mostly be nothing at all.
   The day heads are one way this is reached; the controls stay usable while loading, so focus stays where it was. */
test("takes up a calendar period opened while an earlier request is still running", async ({ page }) => {
  await signIn(page, "editor@test.invalid");

  /* No calendar system is reached from the test server (see playwright.config.ts), so the page arrives in its error
     state and every entry from here on is one this test answered for. Each answer carries the period it was asked
     for, which is what makes a shown entry attributable to a request. */
  const requested: string[] = [];
  let hold: (() => void) | null = null;
  let holdNext = false;
  await page.route(/\/api\/internal\/courses\/[^/]+\/calendar/u, async (route) => {
    const query = new URL(route.request().url()).searchParams;
    const period = `${query.get("ansicht")} ${query.get("datum")}`;
    requested.push(period);
    if (holdNext) {
      holdNext = false;
      await new Promise<void>((resolve) => { hold = resolve; });
    }
    const day = query.get("datum");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ events: [{
        uid: "one", title: `Termin ${period}`, location: "", description: "", allDay: false,
        start: `${day}T09:00:00.000Z`, end: `${day}T10:00:00.000Z`,
      }] }),
    });
  });

  await page.goto("/intern/kurse/e2e-course?kalender=woche");
  await page.getByRole("button", { name: "Erneut laden" }).click();
  await expect(page.getByRole("region", { name: "Wochenkalender" })).toBeVisible();
  await expect(page.getByRole("heading", { name: `Termin ${requested[0]}` })).toBeVisible();

  // The next week, with its answer held back: from here on the calendar is loading and the week stays on screen.
  holdNext = true;
  const nextWeek = page.getByRole("button", { name: "Nächste Woche" });
  await nextWeek.click();
  await expect.poll(() => hold !== null, { timeout: 5_000 }).toBe(true);
  await expect(nextWeek).toBeEnabled();
  await expect(nextWeek).toBeFocused();

  await page.getByRole("button", { name: /Listenansicht ab diesem Tag öffnen/u }).first().click();
  await expect(page).toHaveURL(/kalender=liste/u);
  hold!();

  /* The list is read afterwards, and its answer is the one that ends up on screen — not the week that was already on
     its way when the list was opened. */
  await expect.poll(() => requested.length, { timeout: 10_000 }).toBe(3);
  expect(requested.at(-1)).toMatch(/^liste /u);
  await expect(page.getByRole("heading", { name: `Termin ${requested.at(-1)}` })).toBeVisible();
  await expect(page.getByRole("heading", { name: `Termin ${requested[1]}` })).toHaveCount(0);

  // The views are one radio group: a press chooses one, the arrows move to the next and choose it as well.
  const views = page.getByRole("radiogroup", { name: "Kalenderansicht" });
  await expect(views.getByRole("radio", { name: "Liste" })).toBeChecked();
  await views.getByRole("radio", { name: "Monat" }).click();
  await expect(page).toHaveURL(/kalender=monat/u);
  await page.keyboard.press("ArrowLeft");
  await expect(views.getByRole("radio", { name: "Woche" })).toBeChecked();
  await expect(views.getByRole("radio", { name: "Woche" })).toBeFocused();
  await expect(page).toHaveURL(/kalender=woche/u);

  // Forced colors drop the indicator's fill, so the chosen view has to stand out in the selection colors itself.
  await page.emulateMedia({ forcedColors: "active", colorScheme: "dark" });
  const textColor = (name: string) => views.getByRole("radio", { name }).evaluate((item) => getComputedStyle(item).color);
  expect(await textColor("Woche")).not.toBe(await textColor("Monat"));
  await expect(views.getByRole("radio", { name: "Woche" })).toBeFocused();
  await expectSystemFocusRing(page, views.getByRole("radio", { name: "Woche" }));
});
