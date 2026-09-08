// Datablist sometimes stores website/URL fields as a bare domain
// ("kneaders.com") with no protocol. As an <a href>, that's parsed as a
// relative path under the current page instead of an external link, so
// clicking it silently 404s instead of navigating out.
export function ensureProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
