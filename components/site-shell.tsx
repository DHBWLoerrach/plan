import Link from "next/link";
import type { ReactNode } from "react";

import { AccountMenu } from "@/components/account-menu";
import { DhbwMark } from "@/components/dhbw-mark";
import { getActiveAccount } from "@/lib/internal-auth";
import { productName } from "@/lib/product";

/**
 * The page frame. A section navigation belongs in `nav` rather than in the content, because the skip
 * link jumps to `main`: a navigation repeated on every page of a section would otherwise sit right
 * behind the link that exists to skip it (BARRIEREFREIHEIT.md).
 */
export async function SiteShell({ nav, children }: { nav?: ReactNode; children: ReactNode }) {
  const account = await getActiveAccount();

  return <>
    <a className="skip-link" href="#inhalt">Zum Inhalt springen</a>
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="wordmark" href="/" aria-label={`${productName} – Startseite`}>
          <DhbwMark />
          <span className="wordmark__institution">
            <span className="wordmark__dhbw"><strong>DH</strong><span>BW</span></span>
            <span className="wordmark__location">Lörrach</span>
          </span>
          <span className="wordmark__rule" aria-hidden="true" />
          <span className="wordmark__product">Plan</span>
        </Link>
        <div className="site-header__actions">
          {/* Signing in is the one thing a guest can do here and carries the shape of a button. Signed in,
              the overview is a way on beside the account menu and takes the quieter shape of that menu. */}
          <nav aria-label="Hauptnavigation">{account
            ? <Link href="/intern">Übersicht</Link>
            : <Link className="button button--ghost" href="/intern/anmelden">Anmelden</Link>}</nav>
          {account ? <AccountMenu account={account} /> : null}
        </div>
      </div>
    </header>
    {nav}
    <main id="inhalt" className="site-main">{children}</main>
    <footer className="site-footer"><div><strong>DHBW Lörrach</strong><span>Plan</span></div><nav aria-label="Rechtliche Informationen"><a href="https://www.dhbw.de/impressum/">Impressum</a><a href="https://www.dhbw.de/datenschutz/">Datenschutz</a><Link href="/barrierefreiheit">Barrierefreiheit</Link></nav></footer>
  </>;
}
