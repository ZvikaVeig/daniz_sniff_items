import { config } from "../config";

// Calls the CRM function buyerAgent (Base44). The CRM saves the items, scores them and answers per product.
export async function crm(action: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(config.crmFunctionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": config.crmApiKey },
    body: JSON.stringify({ action, ...body }),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }
  if (!res.ok || data?.ok === false) {
    throw new Error(`CRM ${action}: HTTP ${res.status} ${data?.error || data?.raw || ""}`.trim());
  }
  return data;
}
