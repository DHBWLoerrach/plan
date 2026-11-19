import type { ReactNode } from "react";

import type { CourseAreaCount } from "@/app/intern/kurse/data";

type CourseAreaSelectorProps = {
  areas: CourseAreaCount[];
  selectedArea?: CourseAreaCount;
  allowAll?: boolean;
  action: (formData: FormData) => Promise<void>;
  children?: ReactNode;
};

function courseCountLabel(count: number): string {
  return `${count} ${count === 1 ? "Kurs" : "Kurse"}`;
}

export function CourseAreaSelector({ areas, selectedArea, allowAll = false, action, children }: CourseAreaSelectorProps) {
  const selectedId = selectedArea?.id ?? "";
  const needsSelection = !allowAll && !selectedArea;
  const status = selectedArea
    ? `${selectedArea.name}. ${courseCountLabel(selectedArea.courseCount)} in der Ansicht.`
    : allowAll ? "Alle Bereiche werden angezeigt." : "";

  return <>
    {needsSelection ? <p className="course-area-selector__hint" id="course-area-hint">
      Die Kurskacheln erscheinen nach der Bereichsauswahl.
    </p> : null}
    <form className="course-area-selector" action={action}>
      <div className="course-area-selector__field">
        <label htmlFor="course-area">Bereich</label>
        <select key={selectedId} id="course-area" name="areaId" defaultValue={selectedId} required={!allowAll}
          aria-describedby={needsSelection ? "course-area-hint" : undefined}>
          <option value="" disabled={!allowAll}>{allowAll ? "Alle Bereiche" : "Bereich auswählen"}</option>
          {areas.map((area) => <option key={area.id} value={area.id}>
            {area.name} ({courseCountLabel(area.courseCount)})
          </option>)}
        </select>
      </div>
      <button type="submit" className="button button--ghost">Anzeigen</button>
      {children}
    </form>
    <p className="sr-only" role="status">{status}</p>
  </>;
}
