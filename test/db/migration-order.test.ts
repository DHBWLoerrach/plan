import { describe, expect, it } from "vitest";

import { compareMigrationIds } from "@/lib/db/migration-order.mjs";

describe("compareMigrationIds", () => {
  it("orders by version number rather than as text", () => {
    expect(["10_area_note", "2_areas", "0000_initial"].toSorted(compareMigrationIds))
      .toEqual(["0000_initial", "2_areas", "10_area_note"]);
    // The number counts, not how it is written.
    expect(["1_beta", "01_alpha"].toSorted(compareMigrationIds)).toEqual(["01_alpha", "1_beta"]);
  });

  it("orders migrations that share a version number by their full name", () => {
    // Two branches can each add a `0002_`. Both readers have to reach the same order anyway, and
    // neither may leave it to the file system: it does not answer alike on every machine. Asserted
    // from both starting orders, because a comparison that called the two equal would pass one of
    // them by accident.
    expect(["0002_courses", "0002_areas"].toSorted(compareMigrationIds)).toEqual(["0002_areas", "0002_courses"]);
    expect(["0002_areas", "0002_courses"].toSorted(compareMigrationIds)).toEqual(["0002_areas", "0002_courses"]);
  });
});
