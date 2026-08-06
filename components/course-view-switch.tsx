import Link from "next/link";

import styles from "./course-view-switch.module.css";

export function CourseViewSwitch({ courseId, current }: { courseId: string; current: "plan" | "calendar" }) {
  return <nav className={styles.viewSwitch} aria-label="Kursansicht">
    <p className={styles.viewSwitchLabel}>Ansicht:</p>
    <ul className={styles.viewOptions}>
      <li><Link href={`/intern/kurse/${courseId}`} aria-current={current === "plan" ? "page" : undefined}>Planungsstand</Link></li>
      <li><Link href={`/intern/kurse/${courseId}?kalender=woche`} aria-current={current === "calendar" ? "page" : undefined}>Vorlesungskalender</Link></li>
    </ul>
  </nav>;
}
