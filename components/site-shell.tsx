import Link from "next/link";
import type { ReactNode } from "react";

export function SiteShell({ children }: { children: ReactNode }) {
  return <>
    <a className="skip-link" href="#inhalt">Zum Inhalt springen</a>
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="wordmark" href="/"><span>DHBW</span> Lörrach <small>Blockpläne</small></Link>
        <nav aria-label="Hauptnavigation"><Link href="/">Öffentliche Suche</Link><Link href="/intern/anmelden">Interner Bereich</Link></nav>
      </div>
    </header>
    <main id="inhalt" className="site-main">{children}</main>
    <footer className="site-footer"><div><strong>DHBW Lörrach</strong><span>Blockplanverwaltung</span></div><nav aria-label="Rechtliche Informationen"><a href="https://www.dhbw.de/impressum/">Impressum</a><a href="https://www.dhbw.de/datenschutz/">Datenschutz</a><Link href="/barrierefreiheit">Barrierefreiheit</Link></nav></footer>
  </>;
}
