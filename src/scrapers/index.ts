import { getDefaultSupplier } from "../services/db";
import { BrandoffScraper } from "./brandoffScraper";
import { DefaultHtmlScraper } from "./defaultScraper";
import { SupplierScraper } from "./types";

export function getScraperForSupplier(supplierId = 1): SupplierScraper {
  const supplier = getDefaultSupplier();
  if (supplierId !== supplier.id) {
    throw new Error(`Supplier ${supplierId} not supported yet`);
  }

  switch (supplier.scraper_type) {
    case "brandoff":
      return new BrandoffScraper(supplier.base_url);
    case "html":
    default:
      return new DefaultHtmlScraper(supplier.base_url);
  }
}
