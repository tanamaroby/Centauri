"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Bell, BellOff, BellRing, Loader2, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/client-api";
import { currentSubscription, disablePush, enablePush, pushSupport, sendTestPush, type PushSupport } from "@/lib/push/client";

const noopSubscribe = () => () => {};

type PushStatus = {
  configured: boolean;
  publicKey: string | null;
  scheduler: boolean;
  devices: number;
  upcoming: { title: string; body: string; url: string; fireAt: string }[];
};

export function NotificationsCard() {
  const qc = useQueryClient();
  const { data: status } = useQuery({ queryKey: ["push-status"], queryFn: () => api<PushStatus>("/api/push") });
  const support = useSyncExternalStore<PushSupport | null>(noopSubscribe, pushSupport, () => null);
  const [sub, setSub] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (support === "ok") currentSubscription().then(setSub).catch(() => {});
  }, [support]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["push-status"] });
    }
  }

  const turnOn = () =>
    run(async () => {
      if (!status?.publicKey) throw new Error("Notifications aren't set up on the server yet.");
      const s = await enablePush(status.publicKey);
      setSub(s);
      await sendTestPush(s);
      toast.success("Notifications on");
    });

  const turnOff = () =>
    run(async () => {
      await disablePush();
      setSub(null);
      toast.success("Notifications off on this device");
    });

  const test = () =>
    run(async () => {
      if (!sub) return;
      await sendTestPush(sub);
      toast.success("Test sent");
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-5" /> Notifications
        </CardTitle>
        <CardDescription>
          Reminders a day before and a few hours before flights, ferries, trains and buses, plus hotel check-in and
          check-out.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {support === "install" ? (
          <p className="text-sm text-muted-foreground">
            On iPhone, notifications only work in the installed app. Tap <Share className="inline size-4" /> Share, then{" "}
            <SquarePlus className="inline size-4" /> Add to Home Screen, and open Centauri from there.
          </p>
        ) : support === "unsupported" ? (
          <p className="text-sm text-muted-foreground">This browser doesn&apos;t support notifications.</p>
        ) : status && !status.configured ? (
          <p className="text-sm text-muted-foreground">
            Not set up on the server yet. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to the Vercel project.
          </p>
        ) : sub ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={test} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <BellRing />} Send test
            </Button>
            <Button variant="outline" onClick={turnOff} disabled={busy}>
              <BellOff /> Turn off
            </Button>
          </div>
        ) : (
          <Button className="w-full" onClick={turnOn} disabled={busy || !status}>
            {busy ? <Loader2 className="animate-spin" /> : <Bell />} Turn on notifications
          </Button>
        )}

        {sub && status && !status.scheduler && (
          <p className="text-sm text-muted-foreground">The reminder scheduler isn&apos;t set up yet (CRON_SECRET is missing).</p>
        )}

        {sub && !!status?.upcoming.length && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Coming up</p>
            <ul className="space-y-2">
              {status.upcoming.map((r) => (
                <li key={r.fireAt + r.url + r.title}>
                  <Link href={r.url} className="block rounded-xl border px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{r.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{format(parseISO(r.fireAt), "EEE d MMM, HH:mm")}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{r.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
