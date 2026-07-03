import axios from "axios";
import * as cheerio from "cheerio";
import { buildCatalogPageUrl, buildProductsJsonUrl } from "./catalogs";
import { ScrapedProduct, SupplierScraper } from "./types";

/** Brand Off — Chanel bags collection (Shopify SSR). Kept for legacy DB migration. */
export const BRANDOFF_CHANEL_BAGS_URL =
  "https://brandoffbuyingclub.com/collections/chanel-bags-collection";

const SITE_ORIGIN = "https://brandoffbuyingclub.com";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

interface ShopifyMetaVariant {
  id: number;
  price: number;
  name: string;
  sku?: string;
}

interface ShopifyMetaProduct {
  id: number;
  handle: string;
  vendor?: string;
  variants: ShopifyMetaVariant[];
}

interface ShopifyAnalyticsMeta {
  products?: ShopifyMetaProduct[];
}

/**
 * Shopify collection pages embed product JSON in ShopifyAnalytics.meta via inline script.
 */
export function extractProductsFromEmbeddedMeta(html: string): ScrapedProduct[] {
  const metaJson = extractMetaJson(html);
  if (!metaJson?.products?.length) {
    return [];
  }

  const products: ScrapedProduct[] = [];

  for (const product of metaJson.products) {
    const variant = product.variants?.[0];
    if (!variant?.name || !product.handle) {
      continue;
    }

    const url = `${SITE_ORIGIN}/products/${product.handle}`;
    products.push({
      externalId: String(product.id),
      title: variant.name.trim(),
      url,
      price: formatJpyPrice(variant.price),
      sku: variant.sku,
    });
  }

  return products;
}

function extractMetaJson(html: string): ShopifyAnalyticsMeta | null {
  const marker = "var meta = ";
  const start = html.indexOf(marker);
  if (start === -1) {
    return null;
  }

  const jsonStart = start + marker.length;
  const jsonEnd = findJsonObjectEnd(html, jsonStart);
  if (jsonEnd === -1) {
    return null;
  }

  try {
    return JSON.parse(html.slice(jsonStart, jsonEnd)) as ShopifyAnalyticsMeta;
  } catch {
    return null;
  }
}

/** Walk from opening `{` to matching `}` (handles nested objects/arrays). */
function findJsonObjectEnd(text: string, openBraceIndex: number): number {
  if (text[openBraceIndex] !== "{") {
    return -1;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = openBraceIndex; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return i + 1;
      }
    }
  }

  return -1;
}

/**
 * Fallback when embedded meta is missing (e.g. theme change).
 * Searchanise widget cards may appear after JS; SSR skeleton usually has no titles.
 */
export function extractProductsFromDom(html: string, baseUrl: string): ScrapedProduct[] {
  const $ = cheerio.load(html);
  const products: ScrapedProduct[] = [];
  const seen = new Set<string>();

  const selectors = [
    ".snize-product",
    "[class*='snize-product']",
    ".product-item",
    ".grid__item .card",
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const title =
        $el.find(".snize-title, .snize-product-title, h2, h3, [class*='title']").first().text().trim() ||
        $el.find("a").attr("title")?.trim() ||
        "";
      const href = $el.find("a[href*='/products/']").first().attr("href") ?? "";
      if (!title || !href) {
        return;
      }

      const url = href.startsWith("http") ? href : new URL(href, baseUrl).href;
      if (seen.has(url)) {
        return;
      }
      seen.add(url);

      const price = $el.find(".snize-price, .price, [class*='price']").first().text().trim() || undefined;
      const handleMatch = url.match(/\/products\/([^/?#]+)/);
      const externalId = handleMatch?.[1] ?? url;

      products.push({ externalId, title, url, price });
    });

    if (products.length > 0) {
      break;
    }
  }

  return products;
}

function formatJpyPrice(priceInCents: number): string {
  const yen = Math.round(priceInCents / 100);
  return `¥${yen.toLocaleString("en-US")}`;
}

/** products.json returns the display price string (JPY, no cents), e.g. "102258". */
function formatJpyFromDisplay(priceStr: string | undefined): string | undefined {
  if (!priceStr) return undefined;
  const yen = Math.round(parseFloat(priceStr));
  if (!Number.isFinite(yen)) return undefined;
  return `¥${yen.toLocaleString("en-US")}`;
}

interface ProductsJsonVariant {
  sku?: string;
  price?: string;
}

interface ProductsJsonImage {
  src?: string;
}

interface ProductsJsonProduct {
  id: number;
  handle: string;
  title: string;
  variants?: ProductsJsonVariant[];
  images?: ProductsJsonImage[];
}

export function mapProductsJson(
  products: ProductsJsonProduct[],
  origin: string
): ScrapedProduct[] {
  const mapped: ScrapedProduct[] = [];

  for (const product of products) {
    if (!product.id || !product.handle) {
      continue;
    }

    const variant = product.variants?.[0];
    mapped.push({
      externalId: String(product.id),
      title: product.title.trim(),
      url: `${origin}/products/${product.handle}`,
      price: formatJpyFromDisplay(variant?.price),
      sku: variant?.sku,
      imageUrl: product.images?.[0]?.src,
    });
  }

  return mapped;
}

export class BrandoffScraper implements SupplierScraper {
  constructor(
    private catalogUrl: string = BRANDOFF_CHANEL_BAGS_URL,
    private options: { maxPages?: number; pageDelayMs?: number } = {}
  ) {}

  async fetchProducts(): Promise<ScrapedProduct[]> {
    const maxPages = Math.max(1, this.options.maxPages ?? 1);
    const pageDelayMs = this.options.pageDelayMs ?? 0;

    const merged = new Map<string, ScrapedProduct>();

    for (let page = 1; page <= maxPages; page++) {
      const products = await this.fetchPage(page);

      // A page beyond the last one returns no products; stop early.
      if (products.length === 0 && page > 1) {
        break;
      }

      for (const product of products) {
        if (!merged.has(product.externalId)) {
          merged.set(product.externalId, product);
        }
      }

      if (page < maxPages && pageDelayMs > 0) {
        await delay(pageDelayMs);
      }
    }

    return [...merged.values()];
  }

  private async fetchPage(page: number): Promise<ScrapedProduct[]> {
    // Primary: Shopify products.json feed (real pagination + images).
    const productsJsonUrl = buildProductsJsonUrl(this.catalogUrl, page);
    if (productsJsonUrl) {
      try {
        const response = await axios.get(productsJsonUrl, {
          headers: BROWSER_HEADERS,
          timeout: 30000,
          maxRedirects: 5,
        });
        const data = response.data as { products?: unknown[] };
        const origin = new URL(this.catalogUrl).origin;
        const products = mapProductsJson((data.products ?? []) as never[], origin);
        console.log(`[scraper] brandoff: ${products.length} products from products.json (${productsJsonUrl})`);
        if (products.length > 0 || page > 1) {
          return products;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[scraper] products.json failed (${productsJsonUrl}): ${message}`);
      }
    }

    // Fallback: parse the collection HTML page (embedded meta, then DOM).
    return this.fetchPageFromHtml(page);
  }

  private async fetchPageFromHtml(page: number): Promise<ScrapedProduct[]> {
    const pageUrl = buildCatalogPageUrl(this.catalogUrl, page);
    const response = await axios.get(pageUrl, {
      headers: BROWSER_HEADERS,
      timeout: 30000,
      maxRedirects: 5,
    });

    const html = response.data as string;

    const fromMeta = extractProductsFromEmbeddedMeta(html);
    if (fromMeta.length > 0) {
      console.log(`[scraper] brandoff: ${fromMeta.length} products from embedded meta (${pageUrl})`);
      return fromMeta;
    }

    const fromDom = extractProductsFromDom(html, pageUrl);
    console.log(`[scraper] brandoff: ${fromDom.length} products from DOM fallback (${pageUrl})`);
    return fromDom;
  }
}
