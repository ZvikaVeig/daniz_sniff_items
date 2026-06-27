export interface ScrapedProduct {
  externalId: string;
  title: string;
  url: string;
  price?: string;
  sku?: string;
  imageUrl?: string;
}

export interface SupplierScraper {
  fetchProducts(): Promise<ScrapedProduct[]>;
}
