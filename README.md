# Sandryne Boutique

A luxury fashion e-commerce experience — minimalist, editorial, and highly interactive.
Built with Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui, React Bits Pro,
Framer Motion (`motion`), Supabase, and the Heartland (Global Payments) gateway.

## Stack

| Layer      | Technology                                                     |
| ---------- | -------------------------------------------------------------- |
| Frontend   | Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui        |
| Motion     | `motion` (Framer Motion), GSAP (via React Bits components)     |
| Premium UI | React Bits Pro (`@reactbits-starter` / `@reactbits-pro`)       |
| Backend    | Supabase (Postgres, Auth, Storage, RLS)                        |
| Payments   | Heartland / Global Payments (hosted fields + `globalpayments-api`) |
| Hosting    | Vercel                                                          |

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

The storefront renders with a built-in sample catalog even before Supabase is
configured, so you can develop the UI immediately. Checkout, auth, and the
admin panel require the environment variables below.

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run, in order:
   - [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql) — tables, RLS policies, auth trigger, inventory RPC, `product-images` storage bucket.
   - [`supabase/migrations/002_seed.sql`](supabase/migrations/002_seed.sql) — optional sample catalog.
   - [`supabase/migrations/003_blog.sql`](supabase/migrations/003_blog.sql) — journal posts.
   - [`supabase/migrations/004_journal_replace.sql`](supabase/migrations/004_journal_replace.sql) — journal seed content.
   - [`supabase/migrations/005_homepage_sections.sql`](supabase/migrations/005_homepage_sections.sql) — admin-curated homepage product sections.
   - [`supabase/migrations/006_newsletter_admin.sql`](supabase/migrations/006_newsletter_admin.sql) — admin delete policy for newsletter subscribers.
   - [`supabase/migrations/007_heartland_retail.sql`](supabase/migrations/007_heartland_retail.sql) — Heartland Retail item linkage + order sync columns.
3. Copy the project URL, anon key, and service role key into `.env.local`.
4. Sign up through the site (`/login`), then promote yourself to admin:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## 2. Heartland payments (Portico / Global Payments)

Card charges on this site use Portico — not the Retail inventory API.

1. Create a developer account at [developer.globalpayments.com](https://developer.globalpayments.com/heartland/getting-started/overview).
2. Grab your **public key** (`pkapi_cert_...`) and **secret key** (`skapi_cert_...`).
3. Add them in **Vercel → Settings → Environment Variables** (this project is
   staging until the custom domain is pointed here). Hosted fields tokenize in
   the browser; the Server Action charges the token via `globalpayments-api`.
4. Set `HEARTLAND_DEVELOPER_ID=002914` and `HEARTLAND_VERSION_NUMBER=6401`
   (assigned for this boutique). Every Portico request must send these.
5. Add hCaptcha keys (`NEXT_PUBLIC_HCAPTCHA_SITE_KEY` / `HCAPTCHA_SECRET_KEY`).
   Checkout also rate-limits 5 charges per IP per 10 minutes.
6. **Certification on Vercel staging** (`https://sandryneboutique.vercel.app`): keep cert keys
   (`pkapi_cert_` / `skapi_cert_`) on this Vercel project. Run the script from
   **Admin → Certification** on that URL — never through public checkout, or live
   Retail inventory will drop. After Heartland sends the certification letter, swap
   to `pkapi_prod_` / `skapi_prod_` on the same Vercel project, redeploy, then place
   one cheap live order and confirm Admin → Orders plus Retail sync. Point the custom
   domain at this project only after that cutover.


## 3. Heartland Retail (inventory source of truth)

Retail POS holds live inventory for **in-store, Shopify, and this site**.

1. Log into `https://YOURSTORE.retail.heartland.us`.
2. Create an API token: **Settings → API**.
3. Create a dedicated **Website** location/station for online reporting (recommended).
4. Create a **custom payment type** (e.g. “Website Portico”) under **Settings → Payment Types**,
   enable it for sales orders. This records “already charged on the website” —
   it must **not** charge the card again.
5. Add to `.env.local` / Vercel:
   - `HEARTLAND_RETAIL_SUBDOMAIN`
   - `HEARTLAND_RETAIL_API_TOKEN`
   - `HEARTLAND_RETAIL_STATION_ID`
   - `HEARTLAND_RETAIL_LOCATION_ID`
   - `HEARTLAND_RETAIL_WEB_PAYMENT_TYPE` (custom payment type id)
   - `CRON_SECRET` (protects inventory sync cron)
6. In **Admin → Products**, enter a Heartland **item ID** (or Item #) and click **Look up**
   to autofill name, price, and inventory. Save so `heartland_item_id` is stored.
7. Inventory on this site is mirrored from Retail every 5 minutes via
   `/api/cron/sync-heartland-inventory` (see `vercel.json`). After a website
   purchase, checkout also creates a Retail sales order + invoice so stock
   drops immediately in Retail (and then flows to Shopify).

API reference: [dev.retail.heartland.us](https://dev.retail.heartland.us/).

## 4. Shopify dual-channel (native Heartland connector)

Do **not** build a custom Shopify inventory API in this repo. Use Heartland’s built-in integration:

1. In Heartland Retail: **Settings → Integrations → Shopify** → Connect your store.
2. Ensure each product’s **Heartland Item #** (`public_id` / Item #) **exactly matches**
   the **Shopify SKU**.
3. Prefer **push/sync inventory from Heartland Retail → Shopify** so Retail remains source of truth.
4. Fulfill Shopify orders **in Heartland Retail** (not only in Shopify) so inventory
   decrements correctly — see Heartland’s [Shopify integration guide](https://heartlandpos.my.site.com/lightningcommunity/s/article/How-the-Shopify-v2-integration-works).
5. On this site, keep `heartland_public_id` equal to that same Item # / SKU when
   linking products in admin.

Flow: Shopify sale → Retail inventory ↓ → cron updates this site’s `inventory_count`.
Website sale → Portico charge → Retail sales order/invoice → Retail inventory ↓ → Shopify updates via native sync.

## 5. React Bits Pro

`components.json` registers the `@reactbits-starter` and `@reactbits-pro`
registries. With `REACTBITS_LICENSE_KEY` in `.env.local` you can install more
components any time:

```bash
npx shadcn@latest add @reactbits-starter/silk-waves-tw @reactbits-pro/hero-7
```

## Environment variables (Vercel)

Add all of these in **Vercel > Project > Settings > Environment Variables**:

| Variable                           | Scope   | Purpose                                    |
| ---------------------------------- | ------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`         | Public  | Supabase project URL                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Public  | Supabase anon key (RLS enforced)           |
| `SUPABASE_SERVICE_ROLE_KEY`        | Secret  | Server-only: order writes, admin ops       |
| `NEXT_PUBLIC_HEARTLAND_PUBLIC_KEY` | Public  | Hosted fields tokenization                 |
| `HEARTLAND_SECRET_KEY`             | Secret  | Server-side Portico charges                |
| `HEARTLAND_DEVELOPER_ID`           | Secret  | Portico developer id (`002914`)            |
| `HEARTLAND_VERSION_NUMBER`         | Secret  | Portico version number (`6401`)            |
| `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`    | Public  | Checkout hCaptcha widget                   |
| `HCAPTCHA_SECRET_KEY`              | Secret  | Server-side hCaptcha verify                |
| `HEARTLAND_RETAIL_SUBDOMAIN`       | Secret  | Retail host subdomain                      |
| `HEARTLAND_RETAIL_API_TOKEN`       | Secret  | Retail REST Bearer token                   |
| `HEARTLAND_RETAIL_STATION_ID`      | Secret  | Website station id                         |
| `HEARTLAND_RETAIL_LOCATION_ID`     | Secret  | Fulfillment / inventory location id        |
| `HEARTLAND_RETAIL_WEB_PAYMENT_TYPE`| Secret  | Custom payment type id (already charged)   |
| `CRON_SECRET`                      | Secret  | Authorizes inventory sync cron             |
| `REACTBITS_LICENSE_KEY`            | Secret  | React Bits component installs (build/dev)  |
| `NEXT_PUBLIC_SITE_URL`             | Public  | Canonical URL for auth redirects/metadata  |

Also set `NEXT_PUBLIC_SITE_URL` to `https://sandryneboutique.com` in production
and add that URL to **Supabase > Authentication > URL Configuration**.

## Project structure

```
app/
  (store)/            Storefront: home, shop/[category], products/[slug],
                      checkout, account, login, policies
  admin/              Admin command center (auth + role gated)
                      including /admin/certification (Portico test script)
  api/cron/           Heartland Retail → Supabase inventory mirror
  actions/            Shared server actions (auth, newsletter)
components/
  layout/             Glass header, footer, newsletter
  home/               Hero support, carousels, brand sections
  product/            Cards, gallery, filters, purchase panel
  cart/               Slide-out drawer (zustand store in lib/store)
  checkout/           Heartland hosted-fields checkout form
  admin/              Product form, image uploads, charts, order tools
  react-bits/         React Bits components (installed source)
  blocks/             React Bits Pro blocks (installed source)
lib/
  supabase/           Browser / server / service-role clients
  data/               Product queries + local fallback catalog
  heartland.ts        Portico charge wrapper (server-only)
  heartland-retail.ts Retail items, inventory, sales orders (server-only)
supabase/migrations/  SQL to run in the Supabase SQL Editor
proxy.ts              Session refresh + /admin & /account gating
```

## Commands

```bash
npm run dev     # develop at http://localhost:3000
npm run build   # production build
npm run lint    # eslint
```
