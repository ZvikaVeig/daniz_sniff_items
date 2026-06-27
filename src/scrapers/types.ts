export interface ScrapedProduct {
  externalId: string;
  title: string;
  url: string;
  price?: string;
}

export interface SupplierScraper {
  fetchProducts(): Promise<ScrapedProduct[]>;
}
