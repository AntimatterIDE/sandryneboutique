import "server-only";

export function hcaptchaConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim() && process.env.HCAPTCHA_SECRET_KEY?.trim()
  );
}

export function hcaptchaUsingTestKeys(): boolean {
  const site = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim() ?? "";
  return site.startsWith("10000000-ffff-ffff-ffff-");
}

export async function verifyHCaptcha(
  token: string | undefined,
  remoteIp?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hcaptchaConfigured()) {
    return { ok: true };
  }

  if (!token?.trim()) {
    return { ok: false, error: "Please complete the human verification check." };
  }

  const body = new URLSearchParams({
    secret: process.env.HCAPTCHA_SECRET_KEY!,
    response: token,
  });
  if (remoteIp && remoteIp !== "unknown") {
    body.set("remoteip", remoteIp);
  }

  try {
    const res = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    if (!data.success) {
      return { ok: false, error: "Human verification failed. Please try the checkbox again." };
    }
    return { ok: true };
  } catch (err) {
    console.error("hCaptcha verify failed:", err);
    return { ok: false, error: "We couldn't verify the security check. Please try again." };
  }
}
