/**
 * URL validation utilities for admin-submitted external URLs.
 *
 * LSF-2026-008 / LSF-2026-009: All admin-supplied URLs that the server will
 * later fetch (feed URLs, artwork URLs) must pass these checks before being
 * persisted, to prevent Server-Side Request Forgery (SSRF) attacks that could
 * expose internal network services or cloud instance metadata endpoints.
 */

/**
 * Returns true when `raw` is a safe, publicly-routable HTTP/HTTPS URL.
 *
 * Rejects:
 * - Non-http(s) schemes (file://, ftp://, data://, …)
 * - Loopback addresses (127.x, ::1, localhost, 0.0.0.0)
 * - RFC-1918 private ranges (10.x, 172.16–31.x, 192.168.x)
 * - Link-local / IMDS range (169.254.x — AWS metadata endpoint lives here)
 */
export function isAllowedFeedUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const h = url.hostname;

  // Loopback / localhost
  if (/^(localhost|127\.\d+\.\d+\.\d+|::1|0\.0\.0\.0)$/.test(h)) return false;

  // RFC-1918 private ranges
  if (/^10\.\d+\.\d+\.\d+$/.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(h)) return false;
  if (/^192\.168\.\d+\.\d+$/.test(h)) return false;

  // Link-local / AWS IMDS (169.254.169.254)
  if (/^169\.254\.\d+\.\d+$/.test(h)) return false;

  return true;
}

/**
 * Returns true when `raw` is a safe HTTP/HTTPS URL suitable for storing as
 * an artwork image URL. Applies the same SSRF mitigations as isAllowedFeedUrl.
 */
export function isAllowedArtworkUrl(raw: string): boolean {
  return isAllowedFeedUrl(raw);
}
