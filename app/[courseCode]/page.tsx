import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { publicCourseData } from "@/app/data";
import { CourseDetailView } from "@/components/course-detail";
import { SiteShell } from "@/components/site-shell";
import { publicCutPath, routeSegment } from "@/lib/domain/public-cut";
import { productName } from "@/lib/product";

type DynamicProps = { params: Promise<{ courseCode: string }> };

// Metadata and the page read the same current published course, so a withdrawal cannot leave a stale title behind.
export async function generateMetadata({ params }: DynamicProps): Promise<Metadata> {
  await connection();
  const detail = publicCourseData(routeSegment((await params).courseCode));
  if (!detail) return { title: "Blockplan nicht gefunden", robots: { index: false, follow: true } };
  const title = `${detail.code} · ${detail.program}`;
  const description = `Blockplan des Kurses ${detail.code} mit den Phasen an der DHBW und im Unternehmen sowie den prüfungsrelevanten Terminen.`;
  return {
    title,
    description,
    openGraph: {
      type: "website",
      locale: "de_DE",
      url: publicCutPath({ kind: "course", code: detail.code }),
      siteName: productName,
      title: `${title} | ${productName}`,
      description,
    },
  };
}

export default async function CoursePage({ params }: DynamicProps) {
  await connection();
  const detail = publicCourseData(routeSegment((await params).courseCode));
  if (!detail) notFound();
  return <SiteShell><CourseDetailView detail={detail} /></SiteShell>;
}
