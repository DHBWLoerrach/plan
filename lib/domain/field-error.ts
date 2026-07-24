/**
 * A rejected value together with the field it belongs to. The editor needs both: the message at the field and in the
 * error overview (BARRIEREFREIHEIT.md). Structural rules without a field keep throwing a plain Error.
 */
export class FieldError extends Error {
  constructor(readonly field: string, message: string) {
    super(message);
    this.name = "FieldError";
  }
}
