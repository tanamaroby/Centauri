"use client";

import { useState, type ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorker } from "@/components/service-worker";

const WEEK = 1000 * 60 * 60 * 24 * 7;

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { gcTime: Infinity, staleTime: 30_000, networkMode: "offlineFirst", retry: 1 },
          mutations: { networkMode: "online" },
        },
      }),
  );
  // Tickets are cached on the device so the wallet opens instantly, even offline.
  const [persister] = useState(() =>
    createSyncStoragePersister({ storage: typeof window === "undefined" ? undefined : window.localStorage, key: "centauri-cache" }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <PersistQueryClientProvider client={client} persistOptions={{ persister, maxAge: WEEK * 4, buster: "v1" }}>
        {children}
        <Toaster />
        <ServiceWorker />
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
