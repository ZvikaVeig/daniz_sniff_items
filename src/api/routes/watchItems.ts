import { Router } from "express";
import {
  createWatchItem,
  deleteWatchItem,
  getWatchItem,
  listWatchItems,
  updateWatchItem,
} from "../../services/db";

const router = Router();

router.get("/", (_req, res) => {
  const items = listWatchItems().map(formatWatchItem);
  res.json({ items });
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
  const { keywords, supplierId } = req.body as {
    keywords?: string;
    supplierId?: number;
  };

  if (!keywords?.trim()) {
    res.status(400).json({ error: "keywords is required" });
    return;
  }

  const item = createWatchItem(keywords, supplierId ?? 1);
  res.status(201).json({ item: formatWatchItem(item) });
});

router.put("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { keywords, is_active } = req.body as {
    keywords?: string;
    is_active?: boolean;
  };

  const item = updateWatchItem(id, { keywords, is_active });
  if (!item) {
    res.status(404).json({ error: "Watch item not found" });
    return;
  }

  res.json({ item: formatWatchItem(item) });
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
  is_active: number;
  created_at: string;
}) {
  return {
    id: item.id,
    supplierId: item.supplier_id,
    keywords: item.keywords,
    isActive: item.is_active === 1,
    createdAt: item.created_at,
  };
}

export default router;
