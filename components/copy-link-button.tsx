"use client";

import { Button } from "@ui-sdk/react/button";
import { useState } from "react";

import styles from "./course-detail.module.css";

// The address as it is printed and shared: without a search or fragment the visitor came with.
export function CopyLinkButton({ path }: { path: string }) {
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      setMessage("Link in die Zwischenablage kopiert.");
    } catch {
      setMessage("Kopieren nicht möglich. Bitte kopieren Sie die Adresse aus der Adresszeile.");
    }
  }

  return <>
    <Button className={`button ${styles.copy}`} onClick={copy}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></svg>
      Link kopieren
    </Button>
    <p className={styles.copied} role="status">{message}</p>
  </>;
}
