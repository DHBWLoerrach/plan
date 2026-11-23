// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createAgent } from "@ui-sdk/react/agent";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";

import { PasswordErrorLink, PasswordField, usePasswordFieldController } from "@/components/password-field";

beforeAll(() => {
  vi.stubGlobal("__UI_SDK_STRICT__", true);
  Element.prototype.getAnimations = () => [];
  Element.prototype.checkVisibility = () => true;
});

afterEach(cleanup);

const describedBy = (element: HTMLElement) => (element.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean)
  .map((id) => document.getElementById(id)?.textContent);

function Form({ error }: { error?: string }): ReactNode {
  const controller = usePasswordFieldController();
  return createElement("form", null,
    createElement(PasswordField, { id: "new-password-field", name: "newPassword", label: "Neues Passwort", autoComplete: "new-password", controller, description: "Mindestens 12 Zeichen.", error }),
    error ? createElement(PasswordErrorLink, { fieldId: "new-password-field", controller }, error) : null,
  );
}

it("names, describes and submits the password, and the label leads into the field", () => {
  const { container } = render(createElement(Form));
  const input = screen.getByLabelText<HTMLInputElement>("Neues Passwort", { selector: "input" });

  expect(input.type).toBe("password");
  expect(input.name).toBe("newPassword");
  expect(input.required).toBe(true);
  expect(input.autocomplete).toBe("new-password");
  expect(input.hasAttribute("aria-invalid")).toBe(false);
  expect(describedBy(input)).toEqual(["Mindestens 12 Zeichen."]);
  expect(document.querySelector<HTMLLabelElement>("label")!.htmlFor).toBe(input.id);
  expect(container.querySelector("#new-password-field")?.contains(input)).toBe(true);
});

it("shows the password with a toggle whose name stays the same and points at the field", () => {
  render(createElement(Form));
  const input = screen.getByLabelText<HTMLInputElement>("Neues Passwort", { selector: "input" });
  const toggle = screen.getByRole("button", { name: "Neues Passwort anzeigen" });

  expect(toggle.textContent).toBe("Anzeigen");
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  expect(toggle.getAttribute("aria-controls")).toBe(input.id);
  fireEvent.click(toggle);
  expect(input.type).toBe("text");
  expect(screen.getByRole("button", { name: "Neues Passwort anzeigen" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(toggle);
  expect(input.type).toBe("password");
});

it("marks a refused password at the field and leads there from the summary", () => {
  render(createElement(Form, { error: "Das Passwort ist zu kurz." }));
  const input = screen.getByLabelText<HTMLInputElement>("Neues Passwort", { selector: "input" });

  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(describedBy(input)).toEqual(["Mindestens 12 Zeichen.", "Das Passwort ist zu kurz."]);
  const link = screen.getByRole("link", { name: "Das Passwort ist zu kurz." });
  expect(link.getAttribute("href")).toBe("#new-password-field");
  fireEvent.click(link);
  expect(document.activeElement).toBe(input);
});

it("lets an agent fill the field and show and hide the password", async () => {
  const agent = createAgent();
  render(createElement(Form));

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more");
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
  expect(components.map((entry) => entry.label)).toContain("Neues Passwort");

  const result = await agent.act({ steps: [{ ref: "Neues Passwort", action: "setValue", args: ["Ein-sicheres-Passwort1!"] }] });
  expect(result.ok, result.error?.message).toBe(true);
  const input = screen.getByLabelText<HTMLInputElement>("Neues Passwort", { selector: "input" });
  expect(input.value).toBe("Ein-sicheres-Passwort1!");

  const shown = await agent.act({ steps: [{ ref: "Neues Passwort", action: "toggleVisible" }] });
  expect(shown.ok, shown.error?.message).toBe(true);
  expect(input.type).toBe("text");
  expect(screen.getByRole("button", { name: "Neues Passwort anzeigen" }).getAttribute("aria-pressed")).toBe("true");

  const hidden = await agent.act({ steps: [{ ref: "Neues Passwort", action: "toggleVisible" }] });
  expect(hidden.ok, hidden.error?.message).toBe(true);
  expect(input.type).toBe("password");
});
