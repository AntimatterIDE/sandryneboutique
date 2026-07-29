"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
  createProduct,
  deleteProduct,
  lookupHeartlandItem,
  updateProduct,
  type ProductInput,
} from "@/app/admin/actions";
import type { Product } from "@/lib/types";

const CATEGORY_OPTIONS = [
  { value: "bottoms", label: "Bottoms" },
  { value: "dresses", label: "Dresses" },
  { value: "accessories-jewelry", label: "Accessories & Jewelry" },
  { value: "tops", label: "Tops" },
  { value: "active-wear", label: "Active Wear" },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface ProductFormProps {
  product?: Product;
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(product);

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [inventory, setInventory] = useState(product ? String(product.inventory_count) : "0");
  const [category, setCategory] = useState(product?.category ?? "");
  const [sizes, setSizes] = useState((product?.sizes ?? []).join(", "));
  const [colors, setColors] = useState((product?.colors ?? []).join(", "));
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [isNew, setIsNew] = useState(product?.is_new ?? true);
  const [onSale, setOnSale] = useState(product?.on_sale ?? false);
  const [salePrice, setSalePrice] = useState(
    product?.sale_price != null ? String(product.sale_price) : ""
  );
  const [heartlandItemId, setHeartlandItemId] = useState(
    product?.heartland_item_id != null ? String(product.heartland_item_id) : ""
  );
  const [heartlandPublicId, setHeartlandPublicId] = useState(
    product?.heartland_public_id ?? ""
  );
  const [lookupPending, setLookupPending] = useState(false);

  const buildInput = (): ProductInput => ({
    name: name.trim(),
    description: description.trim(),
    price: Number(price),
    images,
    inventory_count: Number(inventory),
    category,
    slug: slug.trim(),
    sizes: sizes.split(",").map((s) => s.trim()).filter(Boolean),
    colors: colors.split(",").map((c) => c.trim()).filter(Boolean),
    is_new: isNew,
    on_sale: onSale,
    sale_price: onSale && salePrice ? Number(salePrice) : null,
    heartland_item_id: heartlandItemId.trim() ? Number(heartlandItemId.trim()) : null,
    heartland_public_id: heartlandPublicId.trim() || null,
  });

  const handleHeartlandLookup = () => {
    const query = heartlandItemId.trim() || heartlandPublicId.trim();
    if (!query) {
      toast.error("Enter a Heartland item ID or Item # to look up.");
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
        const item = result.item;
        setHeartlandItemId(String(item.heartland_item_id));
        setHeartlandPublicId(item.heartland_public_id ?? "");
        setName(item.name);
        if (!slugTouched) setSlug(slugify(item.name));
        setDescription(item.description);
        setPrice(String(item.price));
        setInventory(String(item.inventory_count));
        toast.success(
          item.active
            ? `Loaded Heartland item ${item.heartland_item_id}.`
            : `Loaded item ${item.heartland_item_id} (marked inactive in Retail).`
        );
      } finally {
        setLookupPending(false);
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      <div className="space-y-3 border border-foreground/10 p-4">
        <div>
          <p className="text-xs tracking-[0.18em] uppercase text-muted-foreground">
            Heartland Retail
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the Retail Item # (recommended) or internal item ID to fill name, price, and
            inventory. Inventory stays synced from Retail; match Item # to your Shopify SKU.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="heartland_item_id">Internal item ID</Label>
            <Input
              id="heartland_item_id"
              value={heartlandItemId}
              onChange={(e) => setHeartlandItemId(e.target.value)}
              placeholder="e.g. 103998"
              className="rounded-none font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="heartland_public_id">Item # (public)</Label>
            <Input
              id="heartland_public_id"
              value={heartlandPublicId}
              onChange={(e) => setHeartlandPublicId(e.target.value)}
              placeholder="e.g. 11907 · matches Shopify SKU"
              className="rounded-none font-mono text-sm"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              disabled={pending || lookupPending}
              onClick={handleHeartlandLookup}
              className="rounded-none tracking-[0.14em] uppercase text-xs h-9 w-full sm:w-auto"
            >
              {lookupPending ? <Loader2 className="size-4 animate-spin" /> : "Look up"}
            </Button>
          </div>
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
          <Select value={category} onValueChange={setCategory} required>
            <SelectTrigger className="rounded-none w-full">
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
          <Label htmlFor="price">Price (USD)</Label>
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
          <Label htmlFor="inventory">Inventory count</Label>
          <Input
            id="inventory"
            type="number"
            min="0"
            step="1"
            value={inventory}
            onChange={(e) => setInventory(e.target.value)}
            required
            className="rounded-none"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sizes">Sizes (comma separated)</Label>
          <Input
            id="sizes"
            value={sizes}
            onChange={(e) => setSizes(e.target.value)}
            placeholder="XS, S, M, L, XL"
            className="rounded-none"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="colors">Colors (comma separated)</Label>
          <Input
            id="colors"
            value={colors}
            onChange={(e) => setColors(e.target.value)}
            placeholder="Ivory, Black"
            className="rounded-none"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Images</Label>
        <ImageManager images={images} onChange={setImages} />
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
