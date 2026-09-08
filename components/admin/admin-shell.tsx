"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LogOut, Menu, Store } from "lucide-react";
import { ADMIN_NAV, isAdminNavActive } from "@/lib/admin-nav";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function NavLinks({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {ADMIN_NAV.map((item) => {
        const active = isAdminNavActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <item.icon className="size-4 shrink-0" strokeWidth={1.5} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ShellFooter({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="space-y-1">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Store className="size-4" strokeWidth={1.5} />
        View Store
      </Link>
      <form action={signOut}>
        <Button
          type="submit"
          variant="ghost"
          className="w-full justify-start px-3 text-sm font-normal text-muted-foreground gap-3"
        >
          <LogOut className="size-4" strokeWidth={1.5} />
          Sign Out
        </Button>
      </form>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = ADMIN_NAV.find((item) => isAdminNavActive(pathname, item));

  return (
    <div className="flex flex-1 h-dvh max-h-dvh overflow-hidden">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-foreground/8 bg-card">
        <div className="px-6 py-6 border-b border-foreground/8">
          <Link href="/admin" className="font-serif text-lg tracking-[0.24em] uppercase">
            Sandryne
          </Link>
          <p className="text-[10px] tracking-[0.24em] uppercase text-muted-foreground mt-1">
            Admin
          </p>
        </div>
        <div className="flex-1 px-3 py-4 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="px-3 py-4 border-t border-foreground/8">
          <ShellFooter />
        </div>
      </aside>

      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-y-auto">
        <header className="md:hidden sticky top-0 z-30 border-b border-foreground/8 bg-background/95 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-none size-10 shrink-0"
                  aria-label="Open menu"
                >
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(100%,20rem)] p-0 flex flex-col">
                <SheetHeader className="px-6 py-5 border-b border-foreground/8 text-left">
                  <SheetTitle className="font-serif text-lg tracking-[0.2em] uppercase font-normal">
                    Sandryne
                  </SheetTitle>
                  <p className="text-[10px] tracking-[0.24em] uppercase text-muted-foreground">
                    Admin
                  </p>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-3 py-4">
                  <NavLinks onNavigate={() => setOpen(false)} />
                </div>
                <div className="px-3 py-4 border-t border-foreground/8">
                  <ShellFooter onNavigate={() => setOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <p className="font-serif text-sm tracking-[0.18em] uppercase truncate">
                {current?.label ?? "Admin"}
              </p>
            </div>

            <Link
              href="/"
              className="text-[10px] tracking-[0.16em] uppercase text-muted-foreground hover:text-foreground shrink-0"
            >
              Store
            </Link>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
