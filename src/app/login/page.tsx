import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="starfield relative flex min-h-dvh flex-col items-center justify-center px-6 pt-safe pb-safe">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-primary/25 to-transparent" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="mb-5 size-20 rounded-[22px] shadow-2xl shadow-primary/30" />
          <h1 className="text-3xl font-semibold tracking-tight">Centauri</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your tickets, among the stars.</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
