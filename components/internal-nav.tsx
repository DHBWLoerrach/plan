import Link from "next/link";

import { type ActiveAccount, managesAnyArea } from "@/lib/internal-auth";

export type InternalSection = "heute" | "home" | "kurse" | "konten";

/**
 * The internal main navigation: the day and courses for area editing, accounts for system administration. The own
 * account page is not listed here, because the account menu in the header already leads there next to signing out.
 * Entries the account may not use stay hidden — which never replaces the permission check on the target page and in
 * every server operation.
 */
export function InternalNav({ account, current }: { account: ActiveAccount; current?: InternalSection }) {
  const manages = managesAnyArea(account);
  const entries: { section: InternalSection; href: string; label: string }[] = [];
  // The day comes first because it is where signing in leads.
  if (manages) entries.push({ section: "heute", href: "/intern/heute", label: "Heute" });
  entries.push({ section: "home", href: "/intern", label: "Übersicht" });
  if (manages) entries.push({ section: "kurse", href: "/intern/kurse", label: "Kurse" });
  if (account.systemAdmin) entries.push({ section: "konten", href: "/intern/konten", label: "Konten" });

  return <nav className="internal-nav" aria-label="Interner Bereich">
    {entries.map((entry) => <Link key={entry.section} href={entry.href} aria-current={entry.section === current ? "page" : undefined}>{entry.label}</Link>)}
  </nav>;
}
