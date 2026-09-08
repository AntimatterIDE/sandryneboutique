"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateOrderStatus } from "@/app/admin/actions";
import type { OrderStatus } from "@/lib/types";

const STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "shipped", label: "Shipped" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
];

export function OrderStatusSelect({
  orderId,
  status,
  locked = false,
}: {
  orderId: string;
  status: OrderStatus;
  locked?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleChange = (value: string) => {
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, value as OrderStatus);
      if (result.ok) {
        toast.success("Order status updated.");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Select value={status} onValueChange={handleChange} disabled={pending || locked}>
      <SelectTrigger size="sm" className="rounded-none w-32 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value} className="text-xs">
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
