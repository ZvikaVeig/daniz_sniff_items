import axios from "axios";
import * as cheerio from "cheerio";
import { ScrapedProduct, SupplierScraper } from "./types";

/** Generic HTML scraper for future suppliers. */
export class DefaultHtmlScraper implements SupplierScraper {
  constructor(private baseUrl: string) {}

  async fetchProducts(): Promise<ScrapedProduct[]> {
    if (!this.baseUrl) {
      throw new Error("Supplier base_url is not configured");
    }

    const response = await axios.get(this.baseUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);
    const products: ScrapedProduct[] = [];

    // TODO: replace with real selectors from supplier site
    $("[data-product], .product, .product-item, article.product").each((_, el) => {
      const $el = $(el);
      const title =
        $el.find("h2, h3, .product-title, .title, [class*='title']").first().text().trim() ||
        $el.find("a").first().attr("title")?.trim() ||
        "";
      const href = $el.find("a").first().attr("href") ?? "";
      const price = $el.find(".price, [class*='price']").first().text().trim() || undefined;

      if (!title || !href) return;

      const url = href.startsWith("http") ? href : new URL(href, this.baseUrl).href;
      const externalId = url;

      products.push({ externalId, title, url, price });
    });

    return products;
  }
}
