import Link from "next/link";

import { type ActiveAccount, managesAnyArea } from "@/lib/internal-auth";

export type InternalSection = "home" | "blockplaene" | "kurse" | "konten";

/**
 * The internal main navigation: block plans and courses for area editing, accounts for system administration. The own
 * account page is not listed here, because the account menu in the header already leads there next to signing out.
 * Entries the account may not use stay hidden — which never replaces the permission check on the target page and in
 * every server operation (MVP-SPEZIFIKATION.md).
 */
export function InternalNav({ account, current }: { account: ActiveAccount; current?: InternalSection }) {
  const entries: { section: InternalSection; href: string; label: string }[] = [{ section: "home", href: "/intern", label: "Übersicht" }];
  if (managesAnyArea(account)) {
    entries.push({ section: "blockplaene", href: "/intern/blockplaene", label: "Blockpläne" });
    entries.push({ section: "kurse", href: "/intern/kurse", label: "Kurse" });
  }
  if (account.systemAdmin) entries.push({ section: "konten", href: "/intern/konten", label: "Konten" });

  return <nav className="internal-nav" aria-label="Interner Bereich">
    {entries.map((entry) => <Link key={entry.section} href={entry.href} aria-current={entry.section === current ? "page" : undefined}>{entry.label}</Link>)}
  </nav>;
}
