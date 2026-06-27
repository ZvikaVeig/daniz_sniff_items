export function normalizeCatalogUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("catalogUrl is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("catalogUrl must be a valid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("catalogUrl must use http or https");
  }

  return parsed.toString();
}
