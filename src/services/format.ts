import { storeName } from "../stores";

export const ils = (n: number | null | undefined) =>
  n == null ? "?" : `₪${Math.round(n).toLocaleString("en-US")}`;

export function supplierPrice(price: number | null | undefined, currency: string | null | undefined) {
  if (!price) return "?";
  const sign = currency === "USD" ? "$" : currency === "JPY" ? "¥" : "";
  return `${sign}${Math.round(price).toLocaleString("en-US")}`;
}

export const scoreText = (s: number | null | undefined) => (s == null ? "?" : String(Math.round(s)));

export function itemLines(r: {
  title?: string | null; store: string; price?: number | null; currency?: string | null;
  cost_ils?: number | null; profit?: number | null; score?: number | null;
}) {
  const unknown = r.profit == null && r.score == null;
  return [
    r.title || "",
    "",
    `חנות: ${storeName(r.store)}`,
    `מחיר אצל הספק: ${supplierPrice(r.price, r.currency)}`,
    `עלות משוערת: ${ils(r.cost_ils)}`,
    `רווח צפוי: ${ils(r.profit)}${unknown ? " (דגם שעוד לא נמכר אצלך)" : ""}`,
    `ציון: ${scoreText(r.score)}`,
  ];
}
