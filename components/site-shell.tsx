import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The page frame. A section navigation belongs in `nav` rather than in the content, because the skip
 * link jumps to `main`: a navigation repeated on every page of a section would otherwise sit right
 * behind the link that exists to skip it (BARRIEREFREIHEIT.md).
 */
export function SiteShell({ nav, children }: { nav?: ReactNode; children: ReactNode }) {
  return <>
    <a className="skip-link" href="#inhalt">Zum Inhalt springen</a>
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="wordmark" href="/"><span>DHBW</span> Lörrach <small>Blockpläne</small></Link>
        <nav aria-label="Hauptnavigation"><Link href="/">Öffentliche Suche</Link><Link href="/intern">Interner Bereich</Link></nav>
      </div>
    </header>
    {nav}
    <main id="inhalt" className="site-main">{children}</main>
    <footer className="site-footer"><div><strong>DHBW Lörrach</strong><span>Blockplanverwaltung</span></div><nav aria-label="Rechtliche Informationen"><a href="https://www.dhbw.de/impressum/">Impressum</a><a href="https://www.dhbw.de/datenschutz/">Datenschutz</a><Link href="/barrierefreiheit">Barrierefreiheit</Link></nav></footer>
  </>;
}
