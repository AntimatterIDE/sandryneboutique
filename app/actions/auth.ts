"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isAuthBypassEnabled } from "@/lib/auth-config";
import { publicSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export interface AuthResult {
  ok: boolean;
  message: string;
}

function supabaseReady(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

const NOT_CONFIGURED: AuthResult = {
  ok: false,
  message: "Accounts are not available yet — the store database is still being configured.",
};

export async function signIn(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  if (!supabaseReady()) return NOT_CONFIGURED;

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/account");

  if (!email || !password) {
    return { ok: false, message: "Please enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, message: "Invalid email or password." };
  }

  try {
    const supabaseUser = await supabase.auth.getUser();
    const userId = supabaseUser.data.user?.id;
    if (userId) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const { linkOrdersToCustomer } = await import("@/lib/account-orders");
      await linkOrdersToCustomer(createAdminClient(), userId, email);
    }
  } catch (err) {
    console.warn("Could not attach guest orders on sign-in:", err);
  }

  revalidatePath("/", "layout");
  redirect(next.startsWith("/") ? next : "/account");
}

export async function signUp(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  if (!supabaseReady()) return NOT_CONFIGURED;

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName) return { ok: false, message: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Please enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (created.error) {
      const text = created.error.message.toLowerCase();
      if (text.includes("already") || text.includes("registered") || text.includes("exists")) {
        return { ok: false, message: "An account already exists for this email. Sign in instead." };
      }
      return { ok: false, message: created.error.message };
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      return {
        ok: false,
        message: "Account created. Sign in with the same email and password.",
      };
    }
    try {
      const { linkOrdersToCustomer } = await import("@/lib/account-orders");
      await linkOrdersToCustomer(admin, created.data.user!.id, email);
    } catch (err) {
      console.warn("Could not attach guest orders to new account:", err);
    }
    try {
      const { sendWelcomeEmail } = await import("@/lib/email");
      await sendWelcomeEmail({ email, fullName });
    } catch (err) {
      console.error("Welcome email failed:", err);
    }
    revalidatePath("/", "layout");
    redirect("/account");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${publicSiteUrl()}/login`,
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  // If email confirmation is disabled, a session exists and we can continue.
  if (data.session) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const { linkOrdersToCustomer } = await import("@/lib/account-orders");
      await linkOrdersToCustomer(createAdminClient(), data.session.user.id, email);
    } catch (err) {
      console.warn("Could not attach guest orders to new account:", err);
    }
    revalidatePath("/", "layout");
    redirect("/account");
  }

  return {
    ok: true,
    message: "Account created — check your email to confirm your address, then sign in.",
  };
}

export async function signOut(): Promise<void> {
  if (isAuthBypassEnabled()) {
    redirect("/");
  }
  if (!supabaseReady()) redirect("/");
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
