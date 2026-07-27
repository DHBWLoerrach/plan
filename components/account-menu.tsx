import Link from "next/link";

import { signOutAction } from "@/app/intern/actions";
import type { ActiveAccount } from "@/lib/internal-auth";

const panelId = "account-menu-panel";

/** The circle stands in for a profile picture the application never has, so the address alone labels the button. */
function accountMonogram(email: string): string {
  return email.slice(0, 2).toUpperCase();
}

/**
 * Who is signed in, the own account page and signing out, gathered behind one button in the header.
 *
 * The panel is a native popover: the browser owns Escape, dismissal on an outside click and returning focus to the
 * button, which is what BARRIEREFREIHEIT.md demands of a menu. Written by hand these would need client state, and
 * the header could no longer be rendered on the server. The panel follows the button in the DOM, so Tab reaches it.
 */
export function AccountMenu({ account }: { account: ActiveAccount }) {
  return <div className="account-menu">
    <button type="button" className="account-menu__toggle" popoverTarget={panelId}>
      <span className="account-menu__avatar" aria-hidden="true">{accountMonogram(account.email)}</span>
      <span className="account-menu__email">{account.email}</span>
    </button>
    <div id={panelId} popover="auto" className="account-menu__panel">
      <p className="account-menu__signed-in">Angemeldet als <strong>{account.email}</strong></p>
      <Link href="/intern/konto">Eigenes Konto</Link>
      <form action={signOutAction}><button className="button button--ghost button--compact" type="submit">Abmelden</button></form>
    </div>
  </div>;
}
