import type { Metadata } from "next";

import { PublicCutPage, publicCutMetadata } from "@/app/public-cut-page";

type DynamicProps = { params: Promise<{ courseCode: string }> };

export async function generateMetadata({ params }: DynamicProps): Promise<Metadata> {
  const { courseCode } = await params;
  return publicCutMetadata({ kind: "course", code: courseCode });
}

export default async function CoursePage({ params }: DynamicProps) {
  const { courseCode } = await params;
  return <PublicCutPage cut={{ kind: "course", code: courseCode }} />;
}
