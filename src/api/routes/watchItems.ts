import { Router } from "express";
import {
  createWatchItem,
  deleteWatchItem,
  getWatchItem,
  listWatchItems,
  updateWatchItem,
} from "../../services/db";
import { getMonitoredSites } from "../../services/monitoring";
import { normalizeCatalogUrl } from "../../utils/catalogUrl";

const router = Router();

router.get("/", (_req, res) => {
  const items = listWatchItems().map(formatWatchItem);
  res.json({ items, monitoredSites: getMonitoredSites() });
});

router.get("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const item = getWatchItem(id);
  if (!item) {
    res.status(404).json({ error: "Watch item not found" });
    return;
  }

  res.json({ item: formatWatchItem(item) });
});

router.post("/", (req, res) => {
  const { keywords, catalogUrl, supplierId } = req.body as {
    keywords?: string;
    catalogUrl?: string;
    supplierId?: number;
  };

  if (!keywords?.trim()) {
    res.status(400).json({ error: "keywords is required" });
    return;
  }

  try {
    // catalogUrl is optional: keywords are matched against all monitored sites.
    const normalizedUrl = catalogUrl?.trim() ? normalizeCatalogUrl(catalogUrl) : "";
    const item = createWatchItem(keywords, normalizedUrl, supplierId ?? 1);
    res.status(201).json({ item: formatWatchItem(item) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid catalogUrl";
    res.status(400).json({ error: message });
  }
});

router.put("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { keywords, catalogUrl, is_active } = req.body as {
    keywords?: string;
    catalogUrl?: string;
    is_active?: boolean;
  };

  try {
    const updates: { keywords?: string; catalogUrl?: string; is_active?: boolean } = {
      keywords,
      is_active,
    };

    if (catalogUrl !== undefined) {
      updates.catalogUrl = normalizeCatalogUrl(catalogUrl);
    }

    const item = updateWatchItem(id, updates);
    if (!item) {
      res.status(404).json({ error: "Watch item not found" });
      return;
    }

    res.json({ item: formatWatchItem(item) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid catalogUrl";
    res.status(400).json({ error: message });
  }
});

router.delete("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const deleted = deleteWatchItem(id);
  if (!deleted) {
    res.status(404).json({ error: "Watch item not found" });
    return;
  }

  res.status(204).send();
});

function formatWatchItem(item: {
  id: number;
  supplier_id: number;
  keywords: string;
  catalog_url: string;
  is_active: number;
  created_at: string;
}) {
  return {
    id: item.id,
    supplierId: item.supplier_id,
    keywords: item.keywords,
    catalogUrl: item.catalog_url,
    isActive: item.is_active === 1,
    createdAt: item.created_at,
  };
}

export default router;
