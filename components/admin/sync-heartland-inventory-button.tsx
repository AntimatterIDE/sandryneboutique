"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncInventoryFromHeartland } from "@/app/admin/actions";

export function SyncHeartlandInventoryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await syncInventoryFromHeartland();
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
          router.refresh();
        });
      }}
      className="rounded-none tracking-[0.16em] uppercase text-xs gap-2"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      Sync from Heartland
    </Button>
  );
}
