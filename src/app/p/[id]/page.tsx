import { Suspense } from "react";
import { PublicPresentationById } from "./public-by-id";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShortSharePage({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">Loading quote...</div>}>
      <PublicPresentationById id={id} />
    </Suspense>
  );
}
