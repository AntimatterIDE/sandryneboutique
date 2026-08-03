"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createCategory,
  deleteCategory,
  updateCategory,
  type CategoryInput,
} from "@/app/admin/actions";
import type { CategoryNode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface CategoryManagerProps {
  tree: CategoryNode[];
}

export function CategoryManager({ tree }: CategoryManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [sortOrder, setSortOrder] = useState("0");

  const parents = useMemo(() => tree, [tree]);

  const resetForm = () => {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setDescription("");
    setParentId("none");
    setSortOrder("0");
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CategoryInput = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
      parent_id: parentId === "none" ? null : parentId,
      sort_order: Number.parseInt(sortOrder, 10) || 0,
    };
    startTransition(async () => {
      const result = await createCategory(input);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      resetForm();
      router.refresh();
    });
  };

  const handleRename = (node: CategoryNode | CategoryNode["children"][number], nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === node.name) return;
    startTransition(async () => {
      const result = await updateCategory(node.id, {
        name: trimmed,
        slug: node.slug,
        description: node.description,
        parent_id: node.parent_id,
        sort_order: node.sort_order,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Category updated.");
      router.refresh();
    });
  };

  const handleDelete = (id: string, label: string) => {
    if (!window.confirm(`Delete “${label}”? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteCategory(id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <form onSubmit={handleCreate} className="space-y-4 border border-foreground/10 p-4 sm:p-5">
        <div>
          <p className="text-xs tracking-[0.18em] uppercase text-muted-foreground">Add category</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a top-level category, or a subcategory under one (e.g. Tops → Tees).
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cat-name">Name</Label>
          <Input
            id="cat-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            required
            className="rounded-none"
            placeholder="e.g. Tees"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cat-slug">Slug</Label>
          <Input
            id="cat-slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            required
            className="rounded-none font-mono text-sm"
            placeholder="tees"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Parent</Label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger className="rounded-none w-full">
              <SelectValue placeholder="Top-level category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None — top-level category</SelectItem>
              {parents.map((parent) => (
                <SelectItem key={parent.id} value={parent.id}>
                  Under {parent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cat-desc">Description</Label>
          <Textarea
            id="cat-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="rounded-none"
            placeholder="Optional shop copy"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cat-sort">Sort order</Label>
          <Input
            id="cat-sort"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="rounded-none w-32"
          />
        </div>

        <Button
          type="submit"
          disabled={pending}
          className="rounded-none tracking-[0.16em] uppercase text-xs h-10 px-6 gap-2"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Create
        </Button>
      </form>

      <div className="space-y-4">
        <div>
          <p className="text-xs tracking-[0.18em] uppercase text-muted-foreground">Current tree</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Click a name to rename. Delete is blocked while products still use a category.
          </p>
        </div>

        {tree.length === 0 ? (
          <div className="border border-dashed border-foreground/15 px-4 py-10 text-center text-sm text-muted-foreground">
            No categories yet. Create your first top-level category.
          </div>
        ) : (
          <ul className="space-y-3">
            {tree.map((parent) => (
              <li key={parent.id} className="border border-foreground/10">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
                  <input
                    defaultValue={parent.name}
                    aria-label={`Rename ${parent.name}`}
                    className="flex-1 bg-transparent text-sm font-medium outline-none"
                    onBlur={(e) => handleRename(parent, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                  />
                  <span className="font-mono text-[11px] text-muted-foreground">{parent.slug}</span>
                  <button
                    type="button"
                    aria-label={`Delete ${parent.name}`}
                    disabled={pending}
                    onClick={() => handleDelete(parent.id, parent.name)}
                    className="p-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {parent.children.length > 0 && (
                  <ul className="divide-y divide-foreground/8">
                    {parent.children.map((child) => (
                      <li key={child.id} className="flex items-center gap-2 px-3 py-2 pl-8">
                        <input
                          defaultValue={child.name}
                          aria-label={`Rename ${child.name}`}
                          className="flex-1 bg-transparent text-sm outline-none"
                          onBlur={(e) => handleRename(child, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                        <span className="font-mono text-[11px] text-muted-foreground">{child.slug}</span>
                        <button
                          type="button"
                          aria-label={`Delete ${child.name}`}
                          disabled={pending}
                          onClick={() => handleDelete(child.id, child.name)}
                          className="p-1.5 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
