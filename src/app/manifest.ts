import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Centauri",
    short_name: "Centauri",
    description: "Your personal ticket wallet and trip planner.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0b1c",
    theme_color: "#0a0b1c",
    categories: ["travel", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Add ticket", url: "/add", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Timeline", url: "/timeline", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
