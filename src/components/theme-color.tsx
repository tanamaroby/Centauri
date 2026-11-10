"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const COLORS = { dark: "#0a0b1c", light: "#f9fafd" } as const;

/**
 * iOS paints the status bar of a home-screen app with theme-color (status-bar style "default").
 * Keep it in step with the in-app theme, not just the system setting, so the bar always
 * matches the page background.
 */
export function ThemeColor() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const color = COLORS[resolvedTheme === "light" ? "light" : "dark"];
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    metas.forEach((m) => {
      m.content = color;
      m.removeAttribute("media");
    });
  }, [resolvedTheme]);
  return null;
}
