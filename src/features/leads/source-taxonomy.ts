export type SourceFacet = { value: string; en: string; vi: string };

export const SOURCE_USE_CASES = [
  { value: "find_companies", en: "Find companies", vi: "Tìm doanh nghiệp" },
  { value: "find_people", en: "Find people", vi: "Tìm người liên hệ" },
  { value: "contact_enrichment", en: "Get emails & phones", vi: "Tìm email và số điện thoại" },
  { value: "recruit_talent", en: "Recruit talent", vi: "Tuyển dụng nhân sự" },
  { value: "influencer_discovery", en: "Find influencers", vi: "Tìm influencer" },
  { value: "social_listening", en: "Monitor conversations", vi: "Theo dõi thảo luận" },
  { value: "competitor_research", en: "Research competitors", vi: "Nghiên cứu đối thủ" },
  { value: "ads_intelligence", en: "Analyze ads", vi: "Phân tích quảng cáo" },
  { value: "product_monitoring", en: "Monitor products & prices", vi: "Theo dõi sản phẩm và giá" },
  { value: "reviews_reputation", en: "Analyze reviews", vi: "Phân tích đánh giá" },
  { value: "seo_content", en: "SEO & content research", vi: "Nghiên cứu SEO và nội dung" },
  { value: "location_research", en: "Research locations", vi: "Nghiên cứu địa điểm" },
  { value: "property_research", en: "Research properties", vi: "Nghiên cứu bất động sản" },
] as const satisfies readonly SourceFacet[];

export const SOURCE_INDUSTRIES = [
  { value: "b2b_saas", en: "B2B & SaaS", vi: "B2B và SaaS" },
  { value: "marketing_agencies", en: "Marketing & agencies", vi: "Marketing và agency" },
  { value: "ecommerce_retail", en: "Ecommerce & retail", vi: "Thương mại điện tử và bán lẻ" },
  { value: "recruitment_hr", en: "Recruitment & HR", vi: "Tuyển dụng và nhân sự" },
  { value: "real_estate", en: "Real estate", vi: "Bất động sản" },
  { value: "hospitality_travel", en: "Hospitality & travel", vi: "Khách sạn và du lịch" },
  { value: "local_business", en: "Local businesses", vi: "Doanh nghiệp địa phương" },
  { value: "healthcare", en: "Healthcare", vi: "Y tế" },
  { value: "education", en: "Education", vi: "Giáo dục" },
  { value: "finance_investment", en: "Finance & investment", vi: "Tài chính và đầu tư" },
  { value: "media_creators", en: "Media & creators", vi: "Truyền thông và creator" },
  { value: "automotive", en: "Automotive", vi: "Ô tô" },
  { value: "manufacturing_logistics", en: "Manufacturing & logistics", vi: "Sản xuất và logistics" },
  { value: "professional_services", en: "Professional services", vi: "Dịch vụ chuyên nghiệp" },
] as const satisfies readonly SourceFacet[];

export const SOURCE_PLATFORMS = [
  { value: "google_maps", en: "Google Maps", vi: "Google Maps" },
  { value: "google_search", en: "Google Search", vi: "Google Search" },
  { value: "linkedin", en: "LinkedIn", vi: "LinkedIn" },
  { value: "facebook", en: "Facebook", vi: "Facebook" },
  { value: "instagram", en: "Instagram", vi: "Instagram" },
  { value: "tiktok", en: "TikTok", vi: "TikTok" },
  { value: "x_twitter", en: "X / Twitter", vi: "X / Twitter" },
  { value: "youtube", en: "YouTube", vi: "YouTube" },
  { value: "reddit", en: "Reddit", vi: "Reddit" },
  { value: "amazon", en: "Amazon", vi: "Amazon" },
  { value: "job_boards", en: "Job boards", vi: "Trang tuyển dụng" },
  { value: "property_portals", en: "Property portals", vi: "Cổng bất động sản" },
  { value: "travel_platforms", en: "Travel platforms", vi: "Nền tảng du lịch" },
  { value: "general_web", en: "General websites", vi: "Website bất kỳ" },
] as const satisfies readonly SourceFacet[];

export const SOURCE_DATA_TYPES = [
  { value: "companies", en: "Companies", vi: "Doanh nghiệp" },
  { value: "people", en: "People & profiles", vi: "Người và hồ sơ" },
  { value: "contacts", en: "Emails & phones", vi: "Email và số điện thoại" },
  { value: "jobs", en: "Jobs", vi: "Việc làm" },
  { value: "social_content", en: "Posts & conversations", vi: "Bài đăng và thảo luận" },
  { value: "audiences", en: "Audiences & creators", vi: "Audience và creator" },
  { value: "ads", en: "Ads", vi: "Quảng cáo" },
  { value: "products", en: "Products & prices", vi: "Sản phẩm và giá" },
  { value: "reviews", en: "Reviews", vi: "Đánh giá" },
  { value: "locations", en: "Places & locations", vi: "Địa điểm" },
  { value: "search_results", en: "Search results", vi: "Kết quả tìm kiếm" },
  { value: "web_content", en: "Web content", vi: "Nội dung website" },
  { value: "properties", en: "Property listings", vi: "Tin bất động sản" },
  { value: "travel", en: "Travel listings", vi: "Dữ liệu du lịch" },
  { value: "news_research", en: "News & research", vi: "Tin tức và nghiên cứu" },
] as const satisfies readonly SourceFacet[];

export type SourceTaxonomy = {
  useCases: string[];
  industries: string[];
  platforms: string[];
  dataTypes: string[];
};

type ClassificationInput = { slug: string; title: string; description: string; categories?: string[] };

function matches(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function add(target: Set<string>, value: string, when: boolean) {
  if (when) target.add(value);
}

export function classifyActorSource(input: ClassificationInput): SourceTaxonomy {
  const titleText = input.title.toLowerCase();
  const nameText = `${input.slug} ${titleText}`.toLowerCase();
  const descriptionText = input.description.toLowerCase();
  const categories = new Set(input.categories || []);
  const text = `${nameText} ${input.description} ${(input.categories || []).join(" ")}`.toLowerCase();
  const platforms = new Set<string>();
  add(platforms, "google_maps", matches(text, /google maps|google places|crawler-google-places/));
  add(platforms, "google_search", matches(text, /google search|\bserp\b|search engine results/));
  add(platforms, "linkedin", text.includes("linkedin"));
  add(platforms, "facebook", text.includes("facebook"));
  add(platforms, "instagram", text.includes("instagram"));
  add(platforms, "tiktok", text.includes("tiktok"));
  add(platforms, "x_twitter", matches(text, /twitter|x\.com|\btweet/));
  add(platforms, "youtube", text.includes("youtube"));
  add(platforms, "reddit", matches(text, /reddit|subreddit/));
  add(platforms, "amazon", text.includes("amazon"));
  add(platforms, "job_boards", matches(text, /indeed|glassdoor|naukri|job board|linkedin jobs|google jobs/));
  add(platforms, "property_portals", matches(text, /zillow|realtor|idealista|property portal|rightmove|redfin/));
  add(platforms, "travel_platforms", matches(text, /booking\.com|tripadvisor|airbnb|expedia|agoda/));
  add(platforms, "general_web", matches(text, /web scraper|website crawler|crawl websites?|scrape any website|sitemap/));

  const dataTypes = new Set<string>();
  add(dataTypes, "companies", platforms.has("google_maps") || matches(titleText, /\b(companies|company|businesses|business|firms?|startups?|merchants?|suppliers?|vendors?|manufacturers?|leads? finder)\b/) || matches(descriptionText, /company (data|details|information|profiles?|lists?|records?)|business (listings?|details|data|directory)|supplier data|merchant data/));
  add(dataTypes, "people", matches(titleText, /\b(people|person|profiles?|employees?|executives?|founders?|candidates?|resumes?|cv)\b/) || matches(descriptionText, /professional profiles?|employee details|people data|candidate profiles?|resume data|founder profiles?/));
  add(dataTypes, "contacts", matches(text, /\b(email|e-mail|phone|contact info|contact detail|mobile number|email finder|email extractor)\b/));
  add(dataTypes, "jobs", categories.has("JOBS") || matches(nameText, /\b(jobs?|recruit|careers?|candidates?|resumes?)\b/) || matches(descriptionText, /job postings?|job listings?|job search|vacanc|hiring|recruiting/));
  add(dataTypes, "social_content", matches(text, /\b(posts?|tweets?|comments?|threads|hashtags?|social media|subreddit|reactions?|engagement)\b/));
  add(dataTypes, "audiences", matches(text, /\b(followers?|following|influencers?|creators?|subscribers?|audience)\b/));
  add(dataTypes, "ads", matches(text, /\b(ad library|ads?|advertis|campaigns?|creatives?|sponsored)\b/));
  add(dataTypes, "products", matches(text, /\b(products?|sku|inventory|stock|catalog|sellers?|shopping|e-?commerce)\b/) || (matches(text, /\bprices?\b/) && matches(text, /product|retail|store|shop|amazon|marketplace/)));
  add(dataTypes, "reviews", matches(text, /\b(reviews?|ratings?|reputation|feedback)\b/));
  add(dataTypes, "locations", platforms.has("google_maps") || matches(text, /\b(places?|addresses?|geocod|latitude|longitude|coordinates?|nearby|local business)\b/));
  add(dataTypes, "search_results", matches(text, /\b(search results?|serp|keywords?|search engine|people also ask)\b/));
  add(dataTypes, "web_content", matches(text, /\b(websites?|web pages?|crawler|crawl |html|sitemap|url list|article content)\b/));
  add(dataTypes, "properties", platforms.has("property_portals") || matches(nameText, /\b(real estate|property|properties|apartments?|realtor|zillow|rental listings?|home listings?)\b/));
  add(dataTypes, "travel", matches(text, /\b(hotels?|travel|flights?|booking\.com|tripadvisor|airbnb|vacation|tourism)\b/));
  add(dataTypes, "news_research", matches(text, /\b(news|articles?|press release|headlines?|publications?|papers?|documents?|pdf|patents?|academic)\b/));

  const useCases = new Set<string>();
  add(useCases, "find_companies", dataTypes.has("companies") || platforms.has("google_maps"));
  add(useCases, "find_people", dataTypes.has("people"));
  add(useCases, "contact_enrichment", dataTypes.has("contacts"));
  add(useCases, "recruit_talent", dataTypes.has("jobs") || matches(text, /candidate|resume|talent sourcing/));
  add(useCases, "influencer_discovery", dataTypes.has("audiences") || matches(text, /influencer|creator discovery/));
  add(useCases, "social_listening", dataTypes.has("social_content") && matches(text, /search|monitor|mention|sentiment|keyword|brand|trend/));
  add(useCases, "competitor_research", matches(text, /competitor|market research|business intelligence|research|trends?|company data/));
  add(useCases, "ads_intelligence", dataTypes.has("ads"));
  add(useCases, "product_monitoring", dataTypes.has("products"));
  add(useCases, "reviews_reputation", dataTypes.has("reviews"));
  add(useCases, "seo_content", platforms.has("google_search") || matches(text, /\bseo\b|serp|keywords?|backlinks?|search engine|content research/));
  add(useCases, "location_research", dataTypes.has("locations"));
  add(useCases, "property_research", dataTypes.has("properties"));

  const industries = new Set<string>();
  add(industries, "b2b_saas", dataTypes.has("companies") || dataTypes.has("contacts") || platforms.has("linkedin"));
  add(industries, "marketing_agencies", dataTypes.has("ads") || dataTypes.has("social_content") || useCases.has("seo_content") || dataTypes.has("audiences"));
  add(industries, "ecommerce_retail", dataTypes.has("products") || matches(text, /amazon|shopify|shopee|lazada|etsy|walmart|retail/));
  add(industries, "recruitment_hr", dataTypes.has("jobs") || matches(text, /candidate|resume|staffing|human resources|\bhr\b/));
  add(industries, "real_estate", dataTypes.has("properties") || matches(nameText, /real estate|realtor|mortgage/));
  add(industries, "hospitality_travel", dataTypes.has("travel") || matches(text, /restaurants?|hospitality/));
  add(industries, "local_business", platforms.has("google_maps") || matches(text, /local business|yelp|yellow pages|restaurants?|directory/));
  add(industries, "healthcare", matches(text, /healthcare|medical|doctors?|dentists?|clinics?|pharma|hospitals?/));
  add(industries, "education", matches(text, /education|schools?|universit|colleges?|courses?|teachers?|students?/));
  add(industries, "finance_investment", matches(text, /finance|financial|funding|investment|investors?|stocks?|crypto|forex|sec filing/));
  add(industries, "media_creators", dataTypes.has("audiences") || dataTypes.has("social_content") || matches(text, /news|podcasts?|publishers?|media/));
  add(industries, "automotive", matches(text, /automotive|vehicles?|cars?|dealership|autotrader/));
  add(industries, "manufacturing_logistics", matches(text, /manufactur|suppliers?|logistics|shipping|freight|industrial/));
  add(industries, "professional_services", matches(text, /consulting|consultants?|agencies|lawyers?|legal|accounting|professional services/));

  const primaryUseCase = platforms.has("google_search") && useCases.has("seo_content") ? "seo_content"
    : dataTypes.has("jobs") && useCases.has("recruit_talent") ? "recruit_talent"
      : dataTypes.has("ads") && useCases.has("ads_intelligence") ? "ads_intelligence"
        : dataTypes.has("products") && useCases.has("product_monitoring") ? "product_monitoring"
          : dataTypes.has("properties") && useCases.has("property_research") ? "property_research"
            : dataTypes.has("audiences") && useCases.has("influencer_discovery") ? "influencer_discovery"
              : useCases.has("social_listening") ? "social_listening"
                : platforms.has("google_maps") && useCases.has("find_companies") ? "find_companies"
                  : dataTypes.has("contacts") && matches(nameText, /email|phone|contact/) ? "contact_enrichment"
                    : dataTypes.has("people") && useCases.has("find_people") ? "find_people"
                      : dataTypes.has("companies") && useCases.has("find_companies") ? "find_companies"
                        : [...useCases][0];
  const orderedUseCases = primaryUseCase ? [primaryUseCase, ...[...useCases].filter((value) => value !== primaryUseCase)] : [];
  return { useCases: orderedUseCases, industries: [...industries], platforms: [...platforms], dataTypes: [...dataTypes] };
}

export function facetLabel(facets: readonly SourceFacet[], value: string, locale: string) {
  const facet = facets.find((item) => item.value === value);
  if (!facet) return value.replaceAll("_", " ");
  return locale.toLowerCase().startsWith("vi") ? facet.vi : facet.en;
}
