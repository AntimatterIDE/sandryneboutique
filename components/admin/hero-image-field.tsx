"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProductImageUpload } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";

interface HeroImageFieldProps {
  value: string;
  onChange: (url: string) => void;
  buttonLabel?: string;
}

function looksLikeImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(avif|gif|jpe?g|png|webp)$/i.test(file.name);
}

export function HeroImageField({
  value,
  onChange,
  buttonLabel = "Upload hero image",
}: HeroImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  const supabaseReady = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!supabaseReady) {
      toast.error("Supabase Storage is not configured — paste an image URL instead.");
      return;
    }
    if (!looksLikeImage(file)) {
      toast.error(`${file.name} is not an image.`);
      return;
    }
    if (file.type === "image/heic" || file.type === "image/heif") {
      toast.error("Export iPhone photos as JPG or PNG first.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Images must be smaller than 10MB.");
      return;
    }

    setUploading(true);
    try {
      const ticket = await createProductImageUpload(file.type, file.size, file.name);
      if (!ticket.ok) {
        toast.error(ticket.message);
        return;
      }

      const ext = ticket.path.split(".").pop() ?? "jpeg";
      const contentType =
        file.type && file.type !== "application/octet-stream"
          ? file.type
          : `image/${ext === "jpg" ? "jpeg" : ext}`;

      const supabase = createClient();
      const { error } = await supabase.storage
        .from("product-images")
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          cacheControl: "31536000",
          contentType,
        });

      if (error) {
        toast.error(error.message);
        return;
      }

      onChange(ticket.publicUrl);
      toast.success("Hero image uploaded. Save the section to publish it.");
    } catch (error) {
      console.error("Hero image upload failed:", error);
      toast.error("The image upload failed unexpectedly. Please try again.");
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
    onChange(url);
    setUrlDraft("");
  };

  return (
    <div className="space-y-3">
      {value ? (
        <div className="relative w-full max-w-md aspect-4/5 bg-muted overflow-hidden">
          <Image src={value} alt="Homepage hero preview" fill sizes="400px" className="object-cover" />
          <button
            type="button"
            aria-label="Remove hero image"
            onClick={() => onChange("")}
            className="absolute top-2 right-2 bg-background/90 p-1.5 text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="w-full max-w-md aspect-4/5 bg-muted/50 border border-dashed border-foreground/15 flex items-center justify-center text-sm text-muted-foreground">
          No hero image yet
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif,.jpg,.jpeg,.png,.webp,.avif,.gif"
          className="hidden"
          onChange={(e) => handleFile(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-none text-[11px] tracking-[0.16em] uppercase gap-2"
        >
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {buttonLabel}
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
          <Button type="button" variant="outline" onClick={addUrl} className="rounded-none">
            Use URL
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        JPG/PNG/WebP up to 10MB (not iPhone HEIC). After uploading, click Save section.
      </p>
    </div>
  );
}
