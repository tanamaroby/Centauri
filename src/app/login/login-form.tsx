"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (res?.ok) {
      const next = params.get("next");
      // Full navigation so the new cookie is used everywhere (and the service worker registers).
      window.location.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      return;
    }
    setPending(false);
    setError(res ? "That password isn't right." : "Can't reach the server. Are you online?");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="relative">
        <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Password"
          autoFocus
          className="h-12 pl-9"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!error}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending || !password}>
        {pending ? <Loader2 className="animate-spin" /> : "Unlock wallet"}
      </Button>
      <p className="pt-2 text-center text-xs text-muted-foreground">You&apos;ll stay signed in on this device.</p>
    </form>
  );
}
