import { calendarLocationParts } from "@/lib/domain/course-calendar";

/**
 * The location of a calendar entry with every address in it as a link. An address is named „Online-Raum“ rather than
 * written out: meeting addresses carry long tokens and passwords that say nothing to the reader and would only break
 * the line. A link opens in a new tab only when it is used, and says so in its accessible name (BARRIEREFREIHEIT.md).
 * Without hooks or state, so the client calendar and the server-rendered day page render it alike.
 */
export function CalendarLocation({ value, linkClassName }: { value: string; linkClassName?: string }) {
  return <>{calendarLocationParts(value).map((part, index) => part.kind === "text"
    ? <span key={index}>{part.text}</span>
    : <a key={index} className={linkClassName} href={part.href} target="_blank" rel="noopener noreferrer">
      Online-Raum<span className="sr-only"> (öffnet in neuem Tab)</span>
    </a>)}</>;
}
