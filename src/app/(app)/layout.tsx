import { AppNav } from "@/components/app-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="relative">
        {/* Glow scrolls with the page (a fixed one looked like a blur under the status bar). */}
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-primary/15 to-transparent" />
        <main className="mx-auto min-h-dvh max-w-lg pt-safe pb-[calc(env(safe-area-inset-bottom)+6rem)]">{children}</main>
      </div>
      <AppNav />
    </>
  );
}
