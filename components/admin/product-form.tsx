"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ImageManager } from "@/components/admin/image-manager";
import {
  createCategory,
  createProduct,
  deleteProduct,
  lookupHeartlandItem,
  updateProduct,
  updateProductImages,
  type ProductInput,
  type VariantInput,
} from "@/app/admin/actions";
import type { CategoryNode, Product, ProductVariant } from "@/lib/types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface DraftVariant {
  key: string;
  id?: string;
  heartland_item_id: string;
  heartland_public_id: string;
  heartland_grid_id: number | null;
  size: string;
  color: string;
  price: string;
  inventory_count: string;
  active: boolean;
  sort_order: number;
}

function toDraftVariants(variants: ProductVariant[] | undefined): DraftVariant[] {
  return (variants ?? []).map((variant, index) => ({
    key: variant.id,
    id: variant.id,
    heartland_item_id: String(variant.heartland_item_id),
    heartland_public_id: variant.heartland_public_id,
    heartland_grid_id: variant.heartland_grid_id,
    size: variant.size ?? "",
    color: variant.color ?? "",
    price: String(variant.price),
    inventory_count: String(variant.inventory_count),
    active: variant.active,
    sort_order: variant.sort_order ?? index,
  }));
}

interface ProductFormProps {
  product?: Product;
  categoryTree: CategoryNode[];
}

export function ProductForm({ product, categoryTree }: ProductFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(product);

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [subcategory, setSubcategory] = useState(product?.subcategory ?? "");
  const [tree, setTree] = useState(categoryTree);
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [isNew, setIsNew] = useState(product?.is_new ?? true);
  const [onSale, setOnSale] = useState(product?.on_sale ?? false);
  const [salePrice, setSalePrice] = useState(
    product?.sale_price != null ? String(product.sale_price) : ""
  );
  const [lookupQuery, setLookupQuery] = useState(
    product?.heartland_public_id ??
      (product?.heartland_item_id != null ? String(product.heartland_item_id) : "")
  );
  const [variants, setVariants] = useState<DraftVariant[]>(() =>
    toDraftVariants(product?.variants)
  );
  const [lookupPending, setLookupPending] = useState(false);
  const [createKind, setCreateKind] = useState<"category" | "subcategory" | null>(null);
  const [createName, setCreateName] = useState("");
  const [createPending, setCreatePending] = useState(false);

  useEffect(() => {
    setTree(categoryTree);
  }, [categoryTree]);

  const subcategoryOptions = useMemo(() => {
    const parent = tree.find((c) => c.slug === category);
    return parent?.children ?? [];
  }, [tree, category]);

  const selectedParent = useMemo(
    () => tree.find((c) => c.slug === category) ?? null,
    [tree, category]
  );

  const totalInventory = useMemo(() => {
    if (variants.length === 0) return product?.inventory_count ?? 0;
    return variants
      .filter((v) => v.active)
      .reduce((sum, v) => sum + (Number.parseInt(v.inventory_count, 10) || 0), 0);
  }, [variants, product?.inventory_count]);

  const updateVariant = (key: string, patch: Partial<DraftVariant>) => {
    setVariants((current) =>
      current.map((variant) => (variant.key === key ? { ...variant, ...patch } : variant))
    );
  };

  const removeVariant = (key: string) => {
    setVariants((current) => current.filter((variant) => variant.key !== key));
  };

  const closeCreateDialog = () => {
    setCreateKind(null);
    setCreateName("");
  };

  const handleCreateCategoryOption = async () => {
    const trimmed = createName.trim();
    if (!trimmed) {
      toast.error("Enter a name.");
      return;
    }
    if (createKind === "subcategory" && !selectedParent) {
      toast.error("Choose a category first.");
      return;
    }
    if (createKind === "subcategory" && selectedParent?.id.startsWith("fallback-")) {
      toast.error("Run migration 008_categories.sql in Supabase before adding subcategories.");
      return;
    }

    const nextSlug = slugify(trimmed);
    if (!nextSlug) {
      toast.error("Name must include letters or numbers.");
      return;
    }

    setCreatePending(true);
    try {
      const result = await createCategory({
        name: trimmed,
        slug: nextSlug,
        description: "",
        parent_id: createKind === "subcategory" ? selectedParent!.id : null,
        sort_order: createKind === "subcategory" ? selectedParent!.children.length * 10 : tree.length * 10,
      });
      if (!result.ok || !result.id) {
        toast.error(result.message);
        return;
      }

      const created: CategoryNode = {
        id: result.id,
        name: trimmed,
        slug: nextSlug,
        description: "",
        parent_id: createKind === "subcategory" ? selectedParent!.id : null,
        sort_order: 0,
        created_at: new Date().toISOString(),
        children: [],
      };

      if (createKind === "category") {
        setTree((current) => [...current, created]);
        setCategory(nextSlug);
        setSubcategory("");
      } else {
        setTree((current) =>
          current.map((parent) =>
            parent.id === selectedParent!.id
              ? { ...parent, children: [...parent.children, created] }
              : parent
          )
        );
        setSubcategory(nextSlug);
      }

      toast.success(result.message);
      closeCreateDialog();
      router.refresh();
    } finally {
      setCreatePending(false);
    }
  };

  const buildInput = (): ProductInput => {
    const variantInputs: VariantInput[] = variants.map((variant, index) => ({
      id: variant.id,
      heartland_item_id: Number(variant.heartland_item_id),
      heartland_public_id: variant.heartland_public_id.trim(),
      heartland_grid_id: variant.heartland_grid_id,
      size: variant.size.trim() || null,
      color: variant.color.trim() || null,
      price: Number(variant.price),
      inventory_count: Number.parseInt(variant.inventory_count, 10) || 0,
      active: variant.active,
      sort_order: variant.sort_order ?? index,
    }));

    const sizes = [
      ...new Set(variantInputs.map((v) => v.size).filter((value): value is string => Boolean(value))),
    ];
    const colors = [
      ...new Set(
        variantInputs.map((v) => v.color).filter((value): value is string => Boolean(value))
      ),
    ];

    return {
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      images,
      inventory_count: totalInventory,
      category,
      subcategory: subcategory.trim() || null,
      slug: slug.trim(),
      sizes,
      colors,
      is_new: isNew,
      on_sale: onSale,
      sale_price: onSale && salePrice ? Number(salePrice) : null,
      heartland_item_id: variantInputs[0]?.heartland_item_id ?? null,
      heartland_public_id: variantInputs[0]?.heartland_public_id ?? null,
      variants: variantInputs,
    };
  };

  const handleHeartlandLookup = () => {
    const query = lookupQuery.trim();
    if (!query) {
      toast.error("Enter a Heartland Item # to look up.");
      return;
    }
    setLookupPending(true);
    startTransition(async () => {
      try {
        const result = await lookupHeartlandItem(query);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        // Creating again for an Item # that already exists just fails — open it instead.
        if (!isEdit && result.existingProduct) {
          toast.message(
            `“${result.existingProduct.name}” is already in the catalog — opening it so you can add photos.`
          );
          router.push(`/admin/products/${result.existingProduct.id}`);
          return;
        }

        const item = result.item;
        setName(item.name);
        if (!slugTouched) {
          const baseSlug = slugify(item.name);
          const styleSlug = item.style ? slugify(item.style) : "";
          setSlug(
            styleSlug && !baseSlug.includes(styleSlug)
              ? `${baseSlug}-${styleSlug}`
              : baseSlug || `item-${item.heartland_public_id ?? query}`
          );
        }
        setDescription(item.description);
        setPrice(String(item.price));
        if (item.category) setCategory(item.category);
        setLookupQuery(item.heartland_public_id ?? query);
        setVariants(
          item.variants.map((variant, index) => ({
            key: `hl-${variant.heartland_item_id}`,
            heartland_item_id: String(variant.heartland_item_id),
            heartland_public_id: variant.heartland_public_id,
            heartland_grid_id: variant.heartland_grid_id,
            size: variant.size ?? "",
            color: variant.color ?? "",
            price: String(variant.price),
            inventory_count: String(variant.inventory_count),
            active: variant.active,
            sort_order: variant.sort_order ?? index,
          }))
        );
        toast.success(
          `Loaded ${item.variants.length} variant${item.variants.length === 1 ? "" : "s"} from Heartland.`
        );
      } finally {
        setLookupPending(false);
      }
    });
  };

  const handleImagesChange = (next: string[]) => {
    setImages(next);
    if (!product) return;
    startTransition(async () => {
      const result = await updateProductImages(product.id, next);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Photos saved.");
      router.refresh();
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!category) {
      toast.error("Please choose a category before saving.");
      return;
    }
    if (!isEdit && variants.length === 0) {
      toast.error("Look up a Heartland Item # first so this product has size/color variants.");
      return;
    }

    startTransition(async () => {
      const input = buildInput();
      const result = product
        ? await updateProduct(product.id, input)
        : await createProduct(input);

      if (result.ok) {
        toast.success(result.message);
        router.push("/admin/products");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleDelete = () => {
    if (!product) return;
    startTransition(async () => {
      const result = await deleteProduct(product.id);
      if (result.ok) {
        toast.success(result.message);
        router.push("/admin/products");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      <div className="space-y-3 border border-foreground/10 p-4">
        <div>
          <p className="text-xs tracking-[0.18em] uppercase text-muted-foreground">
            Heartland Retail
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter any Item # from a style (e.g. 110436). Look up loads the full Item Grid —
            every size and color with its own Item # and inventory.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={lookupQuery}
            onChange={(e) => setLookupQuery(e.target.value)}
            placeholder="Item # e.g. 110436"
            className="rounded-none font-mono text-sm flex-1"
            aria-label="Heartland Item number"
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending || lookupPending}
            onClick={handleHeartlandLookup}
            className="rounded-none tracking-[0.14em] uppercase text-xs h-9"
          >
            {lookupPending ? <Loader2 className="size-4 animate-spin" /> : "Look up grid"}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            required
            className="rounded-none"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            required
            className="rounded-none font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select
            value={category}
            onValueChange={(value) => {
              if (value === "__new_category__") {
                setCreateKind("category");
                setCreateName("");
                return;
              }
              setCategory(value);
              setSubcategory("");
            }}
            required
          >
            <SelectTrigger className="rounded-none w-full">
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {tree.map((opt) => (
                <SelectItem key={opt.slug} value={opt.slug}>
                  {opt.name}
                </SelectItem>
              ))}
              <SelectItem value="__new_category__">+ New category…</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Subcategory</Label>
          <Select
            value={subcategory || "__none__"}
            onValueChange={(value) => {
              if (value === "__new_subcategory__") {
                if (!category) {
                  toast.error("Choose a category first.");
                  return;
                }
                setCreateKind("subcategory");
                setCreateName("");
                return;
              }
              setSubcategory(value === "__none__" ? "" : value);
            }}
            disabled={!category}
          >
            <SelectTrigger className="rounded-none w-full">
              <SelectValue
                placeholder={
                  !category
                    ? "Choose a category first"
                    : subcategoryOptions.length === 0
                      ? "Optional — or create one"
                      : "Optional subcategory"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {subcategoryOptions.map((opt) => (
                <SelectItem key={opt.slug} value={opt.slug}>
                  {opt.name}
                </SelectItem>
              ))}
              {category ? (
                <SelectItem value="__new_subcategory__">+ New subcategory…</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>

        <Dialog
          open={createKind !== null}
          onOpenChange={(open) => {
            if (!open) closeCreateDialog();
          }}
        >
          <DialogContent className="rounded-none sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl font-normal">
                {createKind === "subcategory" ? "New subcategory" : "New category"}
              </DialogTitle>
              <DialogDescription>
                {createKind === "subcategory"
                  ? `Create under ${selectedParent?.name ?? "the selected category"}.`
                  : "Adds a top-level shop category you can assign immediately."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 py-2">
              <Label htmlFor="new-category-name">Name</Label>
              <Input
                id="new-category-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={createKind === "subcategory" ? "e.g. Tees" : "e.g. Outerwear"}
                className="rounded-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCreateCategoryOption();
                  }
                }}
              />
              {createName.trim() ? (
                <p className="text-[11px] text-muted-foreground font-mono">
                  slug: {slugify(createName)}
                </p>
              ) : null}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                onClick={closeCreateDialog}
                disabled={createPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-none tracking-[0.16em] uppercase text-xs gap-2"
                onClick={() => void handleCreateCategoryOption()}
                disabled={createPending}
              >
                {createPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="rounded-none"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="price">Base price (USD)</Label>
          <Input
            id="price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            className="rounded-none"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Total inventory</Label>
          <Input
            value={String(totalInventory)}
            readOnly
            className="rounded-none bg-muted/40"
            aria-label="Total inventory from variants"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <Label>Variants</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Each row is one Heartland sellable item (size × color) with its own stock.
            </p>
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {variants.length} variant{variants.length === 1 ? "" : "s"}
          </p>
        </div>

        {variants.length === 0 ? (
          <div className="border border-dashed border-foreground/15 px-4 py-8 text-center text-sm text-muted-foreground">
            {isEdit
              ? "No Heartland variants linked yet. You can still save photos and details — look up an Item # when you’re ready to sell this style online."
              : "Look up a Heartland Item # to load size/color variants before creating."}
          </div>
        ) : (
          <div className="border border-foreground/10 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/40 text-[11px] tracking-[0.12em] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-normal">Size</th>
                  <th className="px-3 py-2 text-left font-normal">Color</th>
                  <th className="px-3 py-2 text-left font-normal">Item #</th>
                  <th className="px-3 py-2 text-left font-normal">Internal ID</th>
                  <th className="px-3 py-2 text-right font-normal">Price</th>
                  <th className="px-3 py-2 text-right font-normal">Qty</th>
                  <th className="px-3 py-2 text-center font-normal">Active</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {variants.map((variant) => (
                  <tr key={variant.key} className="border-t border-foreground/8">
                    <td className="px-2 py-2">
                      <Input
                        value={variant.size}
                        onChange={(e) => updateVariant(variant.key, { size: e.target.value })}
                        className="rounded-none h-8"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={variant.color}
                        onChange={(e) => updateVariant(variant.key, { color: e.target.value })}
                        className="rounded-none h-8"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={variant.heartland_public_id}
                        onChange={(e) =>
                          updateVariant(variant.key, { heartland_public_id: e.target.value })
                        }
                        className="rounded-none h-8 font-mono text-xs"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={variant.heartland_item_id}
                        onChange={(e) =>
                          updateVariant(variant.key, { heartland_item_id: e.target.value })
                        }
                        className="rounded-none h-8 font-mono text-xs"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={variant.price}
                        onChange={(e) => updateVariant(variant.key, { price: e.target.value })}
                        className="rounded-none h-8 text-right"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={variant.inventory_count}
                        onChange={(e) =>
                          updateVariant(variant.key, { inventory_count: e.target.value })
                        }
                        className="rounded-none h-8 text-right"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Switch
                        checked={variant.active}
                        onCheckedChange={(checked) =>
                          updateVariant(variant.key, { active: checked })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        aria-label="Remove variant"
                        onClick={() => removeVariant(variant.key)}
                        className="p-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <Label>Images</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Most styles are already imported — search Products, open one, and upload photos there.
            Photos auto-save on existing products.
          </p>
        </div>
        <ImageManager images={images} onChange={handleImagesChange} />
      </div>

      <div className="flex flex-wrap gap-8">
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={isNew} onCheckedChange={setIsNew} />
          Mark as New Arrival
        </label>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={onSale} onCheckedChange={setOnSale} />
          On Sale
        </label>
        {onSale && (
          <div className="flex items-center gap-2">
            <Label htmlFor="sale_price" className="text-sm whitespace-nowrap">
              Sale price
            </Label>
            <Input
              id="sale_price"
              type="number"
              min="0"
              step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              required
              className="rounded-none w-32"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-foreground/8">
        <Button
          type="submit"
          disabled={pending}
          className="rounded-none tracking-[0.18em] uppercase text-xs h-11 px-8"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isEdit ? (
            "Save Changes"
          ) : (
            "Create Product"
          )}
        </Button>

        {isEdit && (
          <Dialog>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="rounded-none text-destructive gap-2 text-xs tracking-[0.14em] uppercase"
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this product?</DialogTitle>
                <DialogDescription>
                  &ldquo;{product?.name}&rdquo; will be permanently removed from the catalog.
                  This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={handleDelete}
                  className="rounded-none"
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : "Delete Product"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </form>
  );
}
