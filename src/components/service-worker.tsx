"use client";

import { useEffect } from "react";
import { refreshPushTimeZone } from "@/lib/push/client";

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => refreshPushTimeZone())
      .catch(() => {});
  }, []);
  return null;
}
