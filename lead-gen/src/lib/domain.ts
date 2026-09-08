// Normalizes a company website into a stable dedup key. If no website is given,
// falls back to name+country so every company still gets a unique `domain` value.
export function normalizeDomain(
  website: string | null | undefined,
  name: string,
  hqCountry: string | null | undefined
): string {
  if (website) {
    try {
      const withProtocol = /^https?:\/\//i.test(website) ? website : `https://${website}`;
      const host = new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
      if (host) return host;
    } catch {
      // fall through to the name-based fallback below
    }
  }
  return `noweb:${name.toLowerCase()}:${(hqCountry ?? "").toLowerCase()}`;
}
