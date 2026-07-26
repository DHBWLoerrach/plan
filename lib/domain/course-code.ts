/**
 * The course code filter of the public search and of the internal block plan list. It matches the beginning of a
 * course code without regard to case, so `tif24` finds both `TIF24A` and `TIF24B` (MVP-SPEZIFIKATION.md).
 */
export function normalizeCodePrefix(value: string | null | undefined): string | null {
  return value?.trim().toLocaleLowerCase("de-DE") || null;
}

export function matchesCodePrefix(code: string, prefix: string): boolean {
  return code.toLocaleLowerCase("de-DE").startsWith(prefix);
}
