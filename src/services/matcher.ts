import { ScrapedProduct } from "../scrapers/types";
import { WatchItem } from "./db";

export interface ProductMatch {
  watchItem: WatchItem;
  product: ScrapedProduct;
}

export function matchesKeywords(title: string, keywords: string): boolean {
  const normalizedTitle = title.toLowerCase();
  const terms = keywords
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (terms.length === 0) return false;
  return terms.every((term) => normalizedTitle.includes(term));
}

export function findMatches(products: ScrapedProduct[], watchItems: WatchItem[]): ProductMatch[] {
  const matches: ProductMatch[] = [];

  for (const watchItem of watchItems) {
    for (const product of products) {
      if (matchesKeywords(product.title, watchItem.keywords)) {
        matches.push({ watchItem, product });
      }
    }
  }

  return matches;
}
