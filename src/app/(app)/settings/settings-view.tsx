"use client";

import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, Moon, RefreshCw, Share, SquarePlus, Sun, SunMoon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTickets, useTrips } from "@/lib/client-api";
import { cn } from "@/lib/utils";

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const { data: tickets } = useTickets();
  const { data: trips } = useTrips();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("centauri-cache");
    window.location.replace("/login");
  }

  return (
    <>
      <PageHeader subtitle="Centauri" title="Settings" />
      <div className="space-y-4 px-5">
        <Card>
          <CardHeader>
            <CardTitle>Sync</CardTitle>
            <CardDescription>
              {tickets?.length ?? 0} tickets and {trips?.length ?? 0} trips, stored in your database and cached on this device for offline use.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={async () => {
                await qc.invalidateQueries();
                toast.success("Synced");
              }}
            >
              <RefreshCw /> Sync now
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-2">
            {[
              { id: "dark", label: "Dark", icon: Moon },
              { id: "light", label: "Light", icon: Sun },
              { id: "system", label: "Auto", icon: SunMoon },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className={cn("flex flex-col items-center gap-1 rounded-2xl border py-3 text-sm", theme === id && "border-primary bg-primary/10 text-primary")}
              >
                <Icon className="size-5" /> {label}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Install on iPhone</CardTitle>
            <CardDescription>Open Centauri in Safari, tap <Share className="inline size-4" /> Share, then <SquarePlus className="inline size-4" /> Add to Home Screen. It opens full-screen like a native app.</CardDescription>
          </CardHeader>
        </Card>

        <Button variant="outline" className="w-full text-destructive" onClick={logout}>
          <LogOut /> Sign out of this device
        </Button>
      </div>
    </>
  );
}
