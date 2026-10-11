import assert from "node:assert/strict";
import test from "node:test";
import { classifyActorSource } from "@/features/leads/source-taxonomy";

test("classifies a Google Maps business actor across discovery facets", () => {
  const result = classifyActorSource({
    slug: "compass/crawler-google-places",
    title: "Google Maps Scraper",
    description: "Extract local businesses, addresses, phone numbers, emails, opening hours, and reviews.",
    categories: ["LEAD_GENERATION", "TRAVEL"],
  });
  assert.ok(result.platforms.includes("google_maps"));
  assert.ok(result.dataTypes.includes("companies"));
  assert.ok(result.dataTypes.includes("contacts"));
  assert.ok(result.useCases.includes("find_companies"));
  assert.ok(result.industries.includes("local_business"));
  assert.ok(!result.dataTypes.includes("jobs"));
  assert.ok(!result.industries.includes("recruitment_hr"));
});

test("classifies LinkedIn jobs for recruiting without assigning unrelated verticals", () => {
  const result = classifyActorSource({
    slug: "vendor/linkedin-jobs-scraper",
    title: "LinkedIn Jobs Scraper",
    description: "Extract job postings, employer details, salary and location.",
    categories: ["LEAD_GENERATION", "JOBS"],
  });
  assert.ok(result.platforms.includes("linkedin"));
  assert.ok(result.dataTypes.includes("jobs"));
  assert.ok(result.useCases.includes("recruit_talent"));
  assert.ok(result.industries.includes("recruitment_hr"));
  assert.ok(!result.industries.includes("real_estate"));
});

test("classifies product and advertising actors for ecommerce discovery", () => {
  const result = classifyActorSource({
    slug: "vendor/amazon-ads-and-products",
    title: "Amazon Product and Ads Scraper",
    description: "Monitor product prices, inventory, sellers, sponsored ads and creatives.",
    categories: ["ECOMMERCE", "MARKETING", "LEAD_GENERATION"],
  });
  assert.ok(result.platforms.includes("amazon"));
  assert.ok(result.dataTypes.includes("products"));
  assert.ok(result.dataTypes.includes("ads"));
  assert.ok(result.useCases.includes("product_monitoring"));
  assert.ok(result.useCases.includes("ads_intelligence"));
  assert.ok(result.industries.includes("ecommerce_retail"));
});

test("does not treat job locations, rental pricing or company information as property data", () => {
  const result = classifyActorSource({
    slug: "vendor/indeed-scraper",
    title: "Indeed jobs scraper",
    description: "Extract job postings, hiring company details and locations for a fixed monthly rental price.",
    categories: ["LEAD_GENERATION", "JOBS"],
  });
  assert.ok(result.dataTypes.includes("jobs"));
  assert.ok(!result.dataTypes.includes("properties"));
  assert.ok(!result.dataTypes.includes("products"));
  assert.ok(!result.industries.includes("real_estate"));
});

test("does not classify generic home-service companies as real-estate actors", () => {
  const result = classifyActorSource({
    slug: "vendor/home-services-lead-finder",
    title: "Home Services Lead Finder - HVAC, Plumbing, Roofing",
    description: "Enriched Google Maps leads for US home services contractors with emails and business phones.",
    categories: ["LEAD_GENERATION"],
  });
  assert.equal(result.industries.includes("real_estate"), false);
  assert.equal(result.dataTypes.includes("properties"), false);
  assert.equal(result.useCases.includes("find_companies"), true);
});

test("does not turn generic business audiences or People Also Ask into company and profile data", () => {
  const tweets = classifyActorSource({
    slug: "vendor/tweet-scraper",
    title: "Tweet Scraper",
    description: "Search tweets for researchers, entrepreneurs, and businesses.",
    categories: ["SOCIAL_MEDIA", "LEAD_GENERATION"],
  });
  assert.ok(!tweets.dataTypes.includes("companies"));
  assert.equal(tweets.useCases[0], "social_listening");

  const search = classifyActorSource({
    slug: "vendor/google-search-scraper",
    title: "Google Search Results Scraper",
    description: "Extract organic results, ads, People Also Ask, queries and reviews.",
    categories: ["SEO_TOOLS", "LEAD_GENERATION"],
  });
  assert.ok(!search.dataTypes.includes("people"));
  assert.equal(search.useCases[0], "seo_content");
});
