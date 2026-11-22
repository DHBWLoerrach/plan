import type { Metadata } from "next";

import { PublicCutPage, publicCutMetadata } from "@/app/public-cut-page";
import { programCut, routeSegment } from "@/lib/domain/public-cut";

type DynamicProps = { params: Promise<{ year: string; program: string }> };

export async function generateMetadata({ params }: DynamicProps): Promise<Metadata> {
  const { year, program } = await params;
  return publicCutMetadata(programCut(year, routeSegment(program)));
}

export default async function ProgramPage({ params }: DynamicProps) {
  const { year, program } = await params;
  return <PublicCutPage cut={programCut(year, routeSegment(program))} />;
}
