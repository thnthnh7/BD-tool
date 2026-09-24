import { Suspense } from "react";
import { PublicQuoteLoading } from "@/app/p/public-quote-frame";
import { PublicPresentationById } from "./public-by-id";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShortSharePage({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<PublicQuoteLoading label="Loading quote..." />}>
      <PublicPresentationById id={id} />
    </Suspense>
  );
}
