import { redirect } from "next/navigation";
import { getCategory } from "@/lib/constants";
import { shopHref } from "@/lib/shop";

interface PageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Legacy `/shop/[category]` URLs redirect to the unified shop with filters. */
export default async function CategoryShopRedirect({ params, searchParams }: PageProps) {
  const [{ category }, sp] = await Promise.all([params, searchParams]);
  const def = getCategory(category);

  redirect(
    shopHref({
      q: first(sp.q),
      category: def?.slug,
      size: first(sp.size),
      color: first(sp.color),
      sort: first(sp.sort),
      max: first(sp.max),
      page: first(sp.page),
    })
  );
}
