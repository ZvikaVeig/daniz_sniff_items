import { getDefaultSupplier } from "../services/db";
import { BrandoffScraper } from "./brandoffScraper";
import { DefaultHtmlScraper } from "./defaultScraper";
import { SupplierScraper } from "./types";

export function getScraperForCatalogUrl(catalogUrl: string): SupplierScraper {
  const hostname = new URL(catalogUrl).hostname.toLowerCase();

  if (hostname.includes("brandoffbuyingclub.com")) {
    return new BrandoffScraper(catalogUrl);
  }

  return new DefaultHtmlScraper(catalogUrl);
}

/** @deprecated Use getScraperForCatalogUrl with the watch item catalog URL */
export function getScraperForSupplier(supplierId = 1): SupplierScraper {
  const supplier = getDefaultSupplier();
  if (supplierId !== supplier.id) {
    throw new Error(`Supplier ${supplierId} not supported yet`);
  }
  return getScraperForCatalogUrl(supplier.base_url);
}
