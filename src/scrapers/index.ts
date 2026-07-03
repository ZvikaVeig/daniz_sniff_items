import { config } from "../config";
import { BrandoffScraper } from "./brandoffScraper";
import { DefaultHtmlScraper } from "./defaultScraper";
import { SupplierScraper } from "./types";

export function getScraperForCatalogUrl(catalogUrl: string): SupplierScraper {
  const hostname = new URL(catalogUrl).hostname.toLowerCase();

  if (hostname.includes("brandoffbuyingclub.com")) {
    return new BrandoffScraper(catalogUrl, {
      maxPages: config.scrapeMaxPages,
      pageDelayMs: config.scrapePageDelayMs,
    });
  }

  return new DefaultHtmlScraper(catalogUrl);
}
