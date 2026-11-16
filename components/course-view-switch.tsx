import Link from "next/link";

import { coursePath, defaultComparisonScope } from "@/lib/domain/course-comparison";

import styles from "./course-view-switch.module.css";

/**
 * The three views of one course. The planning state is where it is edited; the comparison sets it beside the other
 * courses of its year and the lecture calendar reads what the DHBW calendar system holds for it — both only read.
 */
export function CourseViewSwitch({ courseId, current }: { courseId: string; current: "plan" | "comparison" | "calendar" }) {
  return <nav className={styles.viewSwitch} aria-label="Kursansicht">
    <p className={styles.viewSwitchLabel}>Ansicht:</p>
    <ul className={styles.viewOptions}>
      <li><Link href={coursePath(courseId)} aria-current={current === "plan" ? "page" : undefined}>Planungsstand</Link></li>
      <li><Link href={coursePath(courseId, defaultComparisonScope)} aria-current={current === "comparison" ? "page" : undefined}>Vergleich</Link></li>
      <li><Link href={`${coursePath(courseId)}?kalender=woche`} aria-current={current === "calendar" ? "page" : undefined}>Vorlesungskalender</Link></li>
    </ul>
  </nav>;
}
