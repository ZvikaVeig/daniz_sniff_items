import { Router } from "express";
import { listRecentFoundProducts } from "../../services/db";

const router = Router();

router.get("/", (req, res) => {
  const rawLimit = parseInt(String(req.query.limit ?? "10"), 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 10;
  const items = listRecentFoundProducts(limit).map(formatFoundProduct);
  res.json({ items });
});

function formatFoundProduct(item: {
  id: number;
  supplier_id: number;
  watch_item_id: number | null;
  external_id: string;
  title: string;
  price: string | null;
  image_url: string | null;
  product_url: string;
  watch_keywords: string | null;
  catalog_url: string | null;
  first_found_at: string;
  last_matched_at: string;
}) {
  return {
    id: item.id,
    supplierId: item.supplier_id,
    watchItemId: item.watch_item_id,
    externalId: item.external_id,
    title: item.title,
    price: item.price,
    imageUrl: item.image_url,
    url: item.product_url,
    watchKeywords: item.watch_keywords,
    catalogUrl: item.catalog_url,
    firstFoundAt: item.first_found_at,
    lastMatchedAt: item.last_matched_at,
  };
}

export default router;
