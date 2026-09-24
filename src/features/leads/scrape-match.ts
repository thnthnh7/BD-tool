import { matchesQuery } from "@/lib/list-page";

export type ScrapeMatchPlace = {
  name: string | null;
  address: string | null;
  city: string | null;
  category: string | null;
  website: string | null;
  phone: string | null;
  match_status: string | null;
};

export type ScrapeMatchPerson = {
  full_name: string | null;
  job_title: string | null;
  email: string | null;
  linkedin_url?: string | null;
};

export function scrapePlaceMatches(query: string, place: ScrapeMatchPlace, people: ScrapeMatchPerson[]) {
  return matchesQuery(query, [
    place.name,
    place.address,
    place.city,
    place.category,
    place.website,
    place.phone,
    place.match_status,
    ...people.flatMap((person) => [person.full_name, person.job_title, person.email, person.linkedin_url]),
  ]);
}
