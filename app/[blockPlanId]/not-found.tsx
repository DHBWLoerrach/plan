import Link from "next/link";
import { SiteShell } from "@/components/site-shell";

export default function NotFound() { return <SiteShell><section className="not-found"><p className="eyebrow">404</p><h1>Blockplan nicht gefunden</h1><p>Dieser Blockplan ist nicht öffentlich verfügbar.</p><Link className="button" href="/">Zur öffentlichen Suche</Link></section></SiteShell>; }
