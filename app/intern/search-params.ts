/** A single URL parameter, with repeated and empty values treated as unset. */
export function searchParam(searchParams: Record<string, string | string[] | undefined>, key: string): string | null {
  const value = searchParams[key];
  return typeof value === "string" && value ? value : null;
}
