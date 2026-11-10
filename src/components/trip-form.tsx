"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Trip, TripInput } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function TripForm({ initial, onSubmit, submitLabel = "Save trip" }: { initial?: Partial<Trip>; onSubmit: (v: TripInput) => Promise<void>; submitLabel?: string }) {
  const [v, setV] = useState<TripInput>({
    name: initial?.name ?? "",
    startDate: initial?.startDate ?? null,
    endDate: initial?.endDate ?? null,
    notes: initial?.notes ?? null,
  });
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await onSubmit(v);
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input required placeholder="Japan in autumn" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Start</Label>
          <Input type="date" value={v.startDate ?? ""} onChange={(e) => setV({ ...v, startDate: e.target.value || null })} />
        </div>
        <div className="space-y-1.5">
          <Label>End</Label>
          <Input type="date" value={v.endDate ?? ""} onChange={(e) => setV({ ...v, endDate: e.target.value || null })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea rows={3} value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value })} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : submitLabel}
      </Button>
    </form>
  );
}
