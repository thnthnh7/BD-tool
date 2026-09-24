import { Suspense } from "react";
import { PublicQuoteLoading } from "@/app/p/public-quote-frame";
import { PublicPresentation } from "./public-presentation";

export default function PublicPresentationPage() {
  return (
    <Suspense fallback={<PublicQuoteLoading label="Loading quote..." />}>
      <PublicPresentation />
    </Suspense>
  );
}
