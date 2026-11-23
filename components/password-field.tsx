"use client";

import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { createPasswordInputController, PasswordInput, PasswordInputControl, PasswordInputToggle } from "@ui-sdk/react/password-input";
import { useState, type ReactNode } from "react";

export type PasswordFieldController = ReturnType<typeof createPasswordInputController>;

export function usePasswordFieldController(): PasswordFieldController {
  return useState(createPasswordInputController)[0];
}

// The anchor scrolls to the field without script; with it, the controller moves focus into the field.
export function PasswordErrorLink({ fieldId, controller, children }: { fieldId: string; controller: PasswordFieldController; children?: ReactNode }) {
  return <a href={`#${fieldId}`} onClick={(event) => { event.preventDefault(); controller.focus(); }}>{children}</a>;
}

// An id of our own on the control would leave the label's `for` and the toggle's `aria-controls` pointing elsewhere,
// so the anchor sits on the field.
export function PasswordField({ id, name, label, autoComplete, description, error, controller }: {
  id: string;
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  description?: ReactNode;
  error?: string;
  controller?: PasswordFieldController;
}) {
  return <Field id={id} name={name} invalid={error ? true : undefined}>
    <FieldLabel>{label}</FieldLabel>
    {description ? <FieldDescription>{description}</FieldDescription> : null}
    <PasswordInput autoComplete={autoComplete} required controller={controller}>
      <PasswordInputControl />
      {/* The name stays the same while aria-pressed carries the state, and it contains the visible word (WCAG 2.5.3). */}
      <PasswordInputToggle aria-label={`${label} anzeigen`}>Anzeigen</PasswordInputToggle>
    </PasswordInput>
    {error ? <FieldError match>{error}</FieldError> : null}
  </Field>;
}
