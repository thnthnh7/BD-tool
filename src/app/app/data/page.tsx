import { permanentRedirect } from "next/navigation";

export default function DataLibraryPage() {
  permanentRedirect("/app/leads/scrape");
}
