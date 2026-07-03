/**
 * Helpers for working with catalog collection URLs:
 * - normalize (strip volatile query params like page / searchanise facets)
 * - build per-page URLs
 * - derive a human-readable site name from the collection handle
 */

const STRIP_QUERY_PARAMS = ["page", "tab"];

/** Remove pagination and Searchanise facet params, keep a clean collection URL. */
export function normalizeCatalogBaseUrl(rawUrl: string): string {
  const url = new URL(rawUrl);

  for (const key of [...url.searchParams.keys()]) {
    if (STRIP_QUERY_PARAMS.includes(key) || key.startsWith("rb_snize")) {
      url.searchParams.delete(key);
    }
  }

  url.hash = "";
  return url.toString();
}

/** Build a URL for a specific collection page (page 1 has no page param). */
export function buildCatalogPageUrl(baseUrl: string, page: number): string {
  const url = new URL(normalizeCatalogBaseUrl(baseUrl));
  if (page > 1) {
    url.searchParams.set("page", String(page));
  }
  return url.toString();
}

/** Extract the Shopify collection handle from a collection URL. */
export function getCollectionHandle(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const match = url.pathname.match(/\/collections\/([^/?#]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Shopify exposes a paginated JSON feed per collection at
 * /collections/{handle}/products.json — this supports real ?page= pagination
 * (unlike the embedded ShopifyAnalytics.meta, which is fixed to one page).
 */
export function buildProductsJsonUrl(baseUrl: string, page: number, limit = 50): string | null {
  const handle = getCollectionHandle(baseUrl);
  if (!handle) {
    return null;
  }

  const origin = new URL(baseUrl).origin;
  const url = new URL(`${origin}/collections/${handle}/products.json`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));
  return url.toString();
}

/** Turn a collection handle into a readable name, e.g. "new-in" -> "New In". */
export function getCatalogDisplayName(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const match = url.pathname.match(/\/collections\/([^/?#]+)/);
    const handle = match?.[1];
    if (!handle) {
      return url.hostname;
    }

    return handle
      .split("-")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } catch {
    return rawUrl;
  }
}
