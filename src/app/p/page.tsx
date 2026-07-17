import { Suspense } from "react";
import { PublicPresentation } from "./public-presentation";

export default function PublicPresentationPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">Loading quote...</div>}>
      <PublicPresentation />
    </Suspense>
  );
}
