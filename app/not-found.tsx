import Link from "next/link";
import { connection } from "next/server";

import { SiteShell } from "@/components/site-shell";

/** Any unknown public path answers in German and points at the public search, just as an unknown block plan does. */
export default async function NotFound() {
  await connection();
  return <SiteShell><section className="not-found">
    <p className="eyebrow">404</p>
    <h1>Seite nicht gefunden</h1>
    <p>Diese Adresse gibt es nicht. Veröffentlichte Blockpläne finden Sie über die öffentliche Suche.</p>
    <Link className="button" href="/">Zur öffentlichen Suche</Link>
  </section></SiteShell>;
}
