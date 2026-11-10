"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { CalendarRange, Map, Plus, Settings, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Wallet", icon: WalletCards },
  { href: "/timeline", label: "Timeline", icon: CalendarRange },
  { href: "/add", label: "Add", icon: Plus, primary: true },
  { href: "/trips", label: "Trips", icon: Map },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav() {
  // The path is request data on dynamic routes, so the active tab streams in.
  return (
    <Suspense fallback={<NavBar pathname={null} />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <NavBar pathname={usePathname()} />;
}

function NavBar({ pathname }: { pathname: string | null }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/80 pb-safe backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <ul className="mx-auto flex max-w-lg items-end justify-around px-2 pt-1.5">
        {items.map(({ href, label, icon: Icon, primary }) => {
          const active = !!pathname && (href === "/" ? pathname === "/" : pathname.startsWith(href));
          if (primary) {
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-label={label}
                  className="-mt-5 mb-1 flex size-14 items-center justify-center rounded-2xl bg-star text-black shadow-lg shadow-star/30 transition active:scale-95"
                >
                  <Icon className="size-7" strokeWidth={2.5} />
                </Link>
              </li>
            );
          }
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex w-16 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
