import type { Metadata } from "next";

import { PublicCutPage, publicCutMetadata } from "@/app/public-cut-page";
import { areaCut, routeSegment } from "@/lib/domain/public-cut";

type DynamicProps = { params: Promise<{ year: string; area: string }> };

export async function generateMetadata({ params }: DynamicProps): Promise<Metadata> {
  const { year, area } = await params;
  return publicCutMetadata(areaCut(year, routeSegment(area)));
}

export default async function AreaPage({ params }: DynamicProps) {
  const { year, area } = await params;
  return <PublicCutPage cut={areaCut(year, routeSegment(area))} />;
}
