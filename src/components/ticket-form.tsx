"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { BARCODE_FORMATS, TICKET_TYPES, type TicketType, type TicketValues } from "@/lib/types";
import { COLOR_GRADIENTS, TYPE_LABEL } from "@/lib/format";
import { useTrips } from "@/lib/client-api";
import { cn } from "@/lib/utils";

export type TicketDraft = Partial<TicketValues>;

const PLACE_LABELS: Record<TicketType, [string, string]> = {
  flight: ["From (airport code)", "To (airport code)"],
  boat: ["From (port)", "To (port)"],
  train: ["From (station)", "To (station)"],
  bus: ["From", "To"],
  stay: ["Place", "Address"],
  event: ["Venue", "Area"],
  other: ["From", "To"],
};

export function TicketForm({
  initial,
  submitLabel = "Save ticket",
  onSubmit,
}: {
  initial: TicketDraft;
  submitLabel?: string;
  onSubmit: (values: TicketDraft) => Promise<void>;
}) {
  const [v, setV] = useState<TicketDraft>({ type: "other", ...initial });
  const [pending, setPending] = useState(false);
  const { data: trips } = useTrips();
  const set = <K extends keyof TicketDraft>(k: K, value: TicketDraft[K]) => setV((s) => ({ ...s, [k]: value }));
  const text = (k: keyof TicketDraft) => ({
    value: (v[k] as string | null | undefined) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
  });
  const type = (v.type ?? "other") as TicketType;
  const isFlight = type === "flight";
  const isBoat = type === "boat";
  const isStay = type === "stay";
  const [fromLabel, toLabel] = PLACE_LABELS[type];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await onSubmit({ ...v, title: v.title?.trim() || "Ticket" });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {TICKET_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => set("type", t)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
              type === t ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <Field label="Title">
        <Input required placeholder="e.g. SQ638 · SIN → NRT" {...text("title")} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={isFlight ? "Airline" : isStay ? "Hotel / host" : "Operator"}>
          <Input {...text("carrier")} />
        </Field>
        <Field label={isFlight ? "Flight no." : isBoat ? "Vessel" : isStay ? "Room" : "Service / no."}>
          <Input {...text("reference")} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={fromLabel}>
          <Input autoCapitalize={isFlight ? "characters" : undefined} {...text(isFlight ? "origin" : "originName")} />
        </Field>
        <Field label={toLabel}>
          <Input autoCapitalize={isFlight ? "characters" : undefined} {...text(isFlight ? "destination" : "destinationName")} />
        </Field>
        {isFlight && (
          <>
            <Field label="From (city)"><Input {...text("originName")} /></Field>
            <Field label="To (city)"><Input {...text("destinationName")} /></Field>
          </>
        )}
      </div>

      <DateTimeField label={isStay ? "Check-in" : "Departure"} value={v.departureAt} onChange={(x) => set("departureAt", x)} />
      <DateTimeField label={isStay ? "Check-out" : "Arrival"} value={v.arrivalAt} onChange={(x) => set("arrivalAt", x)} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Booking ref"><Input autoCapitalize="characters" {...text("bookingRef")} /></Field>
        <Field label="Passenger"><Input autoComplete="name" {...text("passengerName")} /></Field>
        {!isStay && <Field label="Seat"><Input {...text("seat")} /></Field>}
        {isFlight && <Field label="Gate"><Input {...text("gate")} /></Field>}
        {isFlight && <Field label="Terminal"><Input {...text("terminal")} /></Field>}
        {(isFlight || type === "train") && <Field label="Class"><Input {...text("cabinClass")} /></Field>}
        {isFlight && <Field label="Boarding group"><Input {...text("boardingGroup")} /></Field>}
        {(isBoat || type === "train") && <Field label={isBoat ? "Deck / cabin" : "Carriage"}><Input {...text("deck")} /></Field>}
      </div>

      <Field label="Trip">
        <NativeSelect value={v.tripId ?? ""} onChange={(e) => set("tripId", e.target.value || null)}>
          <option value="">No trip</option>
          {trips?.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </NativeSelect>
      </Field>

      <Field label="Card colour">
        <div className="flex flex-wrap gap-2">
          <ColorDot active={!v.color} onClick={() => set("color", null)} className="bg-gradient-to-br from-muted to-muted-foreground/40" label="Auto" />
          {Object.entries(COLOR_GRADIENTS).map(([name, g]) => (
            <ColorDot key={name} active={v.color === name} onClick={() => set("color", name)} className={cn("bg-gradient-to-br", g)} label={name} />
          ))}
        </div>
      </Field>

      <details className="rounded-2xl border px-4 py-3 [&_summary]:cursor-pointer">
        <summary className="text-sm font-medium">Barcode</summary>
        <div className="mt-3 space-y-3">
          <Field label="Barcode data">
            <Textarea className="font-mono text-xs" rows={3} {...text("barcodeData")} />
          </Field>
          <Field label="Format">
            <NativeSelect value={v.barcodeFormat ?? ""} onChange={(e) => set("barcodeFormat", (e.target.value || null) as TicketDraft["barcodeFormat"])}>
              <option value="">None</option>
              {BARCODE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </NativeSelect>
          </Field>
        </div>
      </details>

      <Field label="Notes">
        <Textarea rows={3} placeholder="Baggage allowance, meeting point, pier number…" {...text("notes")} />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : submitLabel}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ColorDot({ active, onClick, className, label }: { active: boolean; onClick: () => void; className: string; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn("size-9 rounded-full ring-offset-2 ring-offset-background transition", className, active && "ring-2 ring-primary")}
    />
  );
}

/** Separate date + optional time inputs (native iOS pickers). Stores "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm". */
function DateTimeField({ label, value, onChange }: { label: string; value?: string | null; onChange: (v: string | null) => void }) {
  const date = value?.slice(0, 10) ?? "";
  const time = value?.includes("T") ? value.slice(11, 16) : "";
  const emit = (d: string, t: string) => onChange(d ? (t ? `${d}T${t}` : d) : null);
  return (
    <Field label={label}>
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2">
        <Input type="date" className="min-w-0" value={date} onChange={(e) => emit(e.target.value, time)} />
        <Input type="time" className="min-w-0" placeholder="Time" value={time} disabled={!date} onChange={(e) => emit(date, e.target.value)} />
      </div>
    </Field>
  );
}
