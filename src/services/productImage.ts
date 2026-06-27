import axios from "axios";
import * as cheerio from "cheerio";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export async function fetchProductImageUrl(productUrl: string): Promise<string | undefined> {
  try {
    const response = await axios.get(productUrl, {
      headers: BROWSER_HEADERS,
      timeout: 15000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data as string);
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      return normalizeImageUrl(ogImage);
    }

    const twitterImage = $('meta[name="twitter:image"]').attr("content");
    if (twitterImage) {
      return normalizeImageUrl(twitterImage);
    }
  } catch (error) {
    console.warn(`[image] Failed to fetch image for ${productUrl}:`, error);
  }

  return undefined;
}

function normalizeImageUrl(url: string): string {
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  if (url.startsWith("http://")) {
    return url.replace("http://", "https://");
  }
  return url;
}
