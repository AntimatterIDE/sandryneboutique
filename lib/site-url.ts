export function publicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw && !/localhost|127\.0\.0\.1/i.test(raw)) {
    return raw.replace(/\/$/, "");
  }
  return "https://sandryneboutique.com";
}
