// The suppliers. All are Shopify stores; codes are the same as in the CRM (BuyerCandidate.store).
export interface Store {
  code: string;
  name: string; // Hebrew name for the Telegram messages
  origin: string;
  currency: "JPY" | "USD";
}

export const STORES: Store[] = [
  { code: "CLUB", name: "קלאב", origin: "https://brandoffbuyingclub.com", currency: "JPY" },
  { code: "PUR1", name: "פרפוס", origin: "https://purposevintagejapan.com", currency: "JPY" },
  { code: "DCT", name: "די-סי-טי", origin: "https://dct-ep-vintageluxurystore.com", currency: "USD" },
];

export const storeName = (code: string) => STORES.find((s) => s.code === code)?.name ?? code;
