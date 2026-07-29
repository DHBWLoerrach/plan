import type { Metadata } from "next";

import { PublicCutPage, publicCutMetadata } from "@/app/public-cut-page";
import { yearCut } from "@/lib/domain/public-cut";

type DynamicProps = { params: Promise<{ year: string }> };

export async function generateMetadata({ params }: DynamicProps): Promise<Metadata> {
  const { year } = await params;
  return publicCutMetadata(yearCut(year));
}

export default async function YearPage({ params }: DynamicProps) {
  const { year } = await params;
  return <PublicCutPage cut={yearCut(year)} />;
}
