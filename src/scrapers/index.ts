import { getDefaultSupplier } from "../services/db";
import { DefaultHtmlScraper } from "./defaultScraper";
import { SupplierScraper } from "./types";

export function getScraperForSupplier(supplierId = 1): SupplierScraper {
  const supplier = getDefaultSupplier();
  if (supplierId !== supplier.id) {
    throw new Error(`Supplier ${supplierId} not supported yet`);
  }

  switch (supplier.scraper_type) {
    case "html":
    default:
      return new DefaultHtmlScraper(supplier.base_url);
  }
}
