import "server-only";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hits = new Map<string, number[]>();

export function getClientIp(headerList: Headers): string {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headerList.get("x-real-ip")?.trim() || "unknown";
}

/** Best-effort per-instance limit: 5 checkout charges per IP per 10 minutes. */
export function consumeCheckoutAttempt(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    hits.set(ip, recent);
    const oldest = recent[0] ?? now;
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000)) };
  }
  recent.push(now);
  hits.set(ip, recent);
  return { ok: true };
}
