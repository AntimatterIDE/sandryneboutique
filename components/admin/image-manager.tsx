"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProductImageUpload } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";

interface ImageManagerProps {
  images: string[];
  onChange: (images: string[]) => void;
}

function looksLikeImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(avif|gif|jpe?g|png|webp)$/i.test(file.name);
}

export function ImageManager({ images, onChange }: ImageManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  const supabaseReady = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!supabaseReady) {
      toast.error("Supabase Storage is not configured — paste an image URL instead.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const uploaded: string[] = [];

    try {
      for (const file of Array.from(files)) {
        if (!looksLikeImage(file)) {
          toast.error(`${file.name} is not an image.`);
          continue;
        }
        if (file.type === "image/heic" || file.type === "image/heif") {
          toast.error(`${file.name}: export iPhone photos as JPG or PNG first.`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is larger than 10MB.`);
          continue;
        }

        // Tiny authorize request only — file bytes go straight to Supabase (avoids Vercel 413).
        const ticket = await createProductImageUpload(file.type, file.size, file.name);
        if (!ticket.ok) {
          toast.error(`Upload failed for ${file.name}: ${ticket.message}`);
          continue;
        }

        const ext = ticket.path.split(".").pop() ?? "jpeg";
        const contentType =
          file.type && file.type !== "application/octet-stream"
            ? file.type
            : `image/${ext === "jpg" ? "jpeg" : ext}`;

        const { error } = await supabase.storage
          .from("product-images")
          .uploadToSignedUrl(ticket.path, ticket.token, file, {
            cacheControl: "31536000",
            contentType,
          });

        if (error) {
          console.error("Image upload failed:", error);
          toast.error(`Upload failed for ${file.name}: ${error.message}`);
          continue;
        }

        uploaded.push(ticket.publicUrl);
      }

      if (uploaded.length > 0) {
        onChange([...images, ...uploaded]);
        toast.success(`${uploaded.length} image${uploaded.length > 1 ? "s" : ""} uploaded.`);
      }
    } catch (error) {
      console.error("Image upload failed:", error);
      const message =
        error instanceof Error && /413|too large|unexpected response/i.test(error.message)
          ? "That photo is too large for the upload path — try a smaller JPG/PNG under 10MB."
          : "The image upload failed unexpectedly. Please try again.";
      toast.error(message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      toast.error("Please enter a valid image URL.");
      return;
    }
    onChange([...images, url]);
    setUrlDraft("");
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {images.map((src, i) => (
            <div key={`${src}-${i}`} className="relative group aspect-3/4 bg-muted overflow-hidden">
              <Image src={src} alt={`Product image ${i + 1}`} fill sizes="150px" className="object-cover" />
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 bg-foreground text-background text-[9px] tracking-[0.14em] uppercase px-1.5 py-0.5">
                  Cover
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-between p-1.5 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  aria-label="Move image left"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-white disabled:opacity-30"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                  className="text-white"
                >
                  <X className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move image right"
                  onClick={() => move(i, 1)}
                  disabled={i === images.length - 1}
                  className="text-white disabled:opacity-30"
                >
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif,.jpg,.jpeg,.png,.webp,.avif,.gif"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-none text-[11px] tracking-[0.16em] uppercase gap-2"
        >
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          Upload high-res images
        </Button>
        <div className="flex flex-1 gap-2">
          <Input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
            placeholder="…or paste an image URL"
            className="rounded-none"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addUrl}
            aria-label="Add image URL"
            className="rounded-none"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        JPG/PNG/WebP up to 10MB (not iPhone HEIC). Files upload directly to storage.
      </p>
    </div>
  );
}
