"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, FileUp, Keyboard, Link2, Loader2, ScanLine, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { TicketForm, type TicketDraft } from "@/components/ticket-form";
import { CameraScanner } from "@/components/camera-scanner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { uploadAttachment, useAddAttachments, useSaveTicket, useTickets } from "@/lib/client-api";
import { fieldsFrom, type DecodedBarcode } from "@/lib/parse/extract";
import { isBcbp } from "@/lib/parse/bcbp";
import { applySuggestions, boardingPassPatch, findMatchingBooking, KIND_LABEL, mergeSuggestions, type MergeSuggestion } from "@/lib/tickets";
import { findRelatedTickets, type TicketMatch } from "@/lib/match";
import { parseExtras, type Extras } from "@/lib/parse/extras";
import { kindOptions, SuggestionChecklist } from "@/components/ticket-attachments";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { fmtDay } from "@/lib/format";
import type { Attachment, Ticket, TicketValues } from "@/lib/types";
import { cn } from "@/lib/utils";

type Step =
  | { kind: "choose" }
  | { kind: "camera" }
  | { kind: "working"; status: string }
  | {
      kind: "review";
      draft: TicketDraft;
      file?: File;
      preview?: string;
      summary: string;
      /** A booking this boarding pass belongs to. */
      match?: Ticket | null;
      /** Other active tickets this file looks like it complements (receipts, add-ons, re-sent confirmations). */
      related?: TicketMatch[];
      extras?: Extras;
    };

export function AddTicket() {
  const router = useRouter();
  const save = useSaveTicket();
  const { data: tickets } = useTickets();
  const matchFor = (draft: TicketDraft) =>
    draft.barcodeData && isBcbp(draft.barcodeData) ? findMatchingBooking(tickets ?? [], draft) : null;
  // A boarding pass for a saved booking has its own flow; everything else is checked against active tickets.
  const relatedFor = (draft: TicketDraft, text: string) =>
    draft.barcodeData && isBcbp(draft.barcodeData) && matchFor(draft) ? [] : findRelatedTickets(tickets ?? [], draft as Partial<TicketValues>, text);
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setStep({ kind: "working", status: "Opening file…" });
    try {
      const { extractFromFile } = await import("@/lib/parse/extract");
      const result = await extractFromFile(file, { onStatus: (status) => setStep({ kind: "working", status }) });
      const f = result.fields;
      const found = (
        f.type === "stay"
          ? [f.title && f.title !== "Hotel stay" ? "hotel" : null, f.departureAt && f.arrivalAt ? "check-in and check-out" : f.departureAt ? "check-in date" : null, f.bookingRef ? "confirmation no." : null, f.roomType ? "room" : null]
          : [result.barcodes.length ? `${result.barcodes[0].format.toUpperCase()} code` : null, f.departureAt ? "date" : null, f.bookingRef ? "booking ref" : null]
      ).filter(Boolean);
      setStep({
        kind: "review",
        draft: result.fields,
        file,
        preview: result.preview,
        match: matchFor(result.fields),
        related: relatedFor(result.fields, result.text),
        extras: parseExtras(result.text),
        summary: found.length ? `Found ${found.join(", ")}. Check the details below.` : "Couldn't read much from this file. Fill in the details below.",
      });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't read that file. You can still enter the details manually.");
      setStep({ kind: "review", draft: { title: file.name.replace(/\.[^.]+$/, "") }, file, summary: "Enter the details below." });
    }
  }

  const onScan = useCallback((code: DecodedBarcode) => {
    const draft = fieldsFrom("", [code]);
    setStep({
      kind: "review",
      draft,
      match: matchFor(draft),
      summary: draft.type === "flight" ? "Boarding pass scanned. Add the departure time if needed." : "Code scanned. Add the details below.",
    });
  }, [tickets]); // eslint-disable-line react-hooks/exhaustive-deps

  async function uploadStepFile(kind: Attachment["kind"]): Promise<Attachment | undefined> {
    if (step.kind !== "review" || !step.file) return undefined;
    const t = toast.loading("Uploading file…");
    try {
      return await uploadAttachment(step.file, kind);
    } catch (e) {
      console.error(e);
      toast.warning("Couldn't store the original file (is Vercel Blob set up?). Saving the details anyway.");
      return undefined;
    } finally {
      toast.dismiss(t);
    }
  }

  /** Attach this boarding pass to the existing booking instead of creating a duplicate. */
  async function attachToBooking(booking: Ticket) {
    if (step.kind !== "review") return;
    try {
      const file = await uploadStepFile("boarding");
      await save.mutateAsync({ id: booking.id, values: boardingPassPatch(booking, step.draft, file) });
      toast.success("Boarding pass added to your booking");
      router.replace(`/tickets/${booking.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't attach the boarding pass");
    }
  }

  async function onSubmit(values: TicketDraft) {
    if (step.kind !== "review") return;
    try {
      const isPass = !!values.barcodeData && isBcbp(values.barcodeData);
      const file = await uploadStepFile(isPass ? "boarding" : values.type === "flight" || values.type === "stay" ? "booking" : "other");
      const ticket = await save.mutateAsync({
        values: { ...values, checkedIn: isPass, attachments: file ? [file] : [] },
      });
      toast.success("Added to your wallet");
      router.replace(`/tickets/${ticket.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the ticket");
    }
  }

  return (
    <>
      <PageHeader
        subtitle="New"
        title="Add ticket"
        action={
          step.kind !== "choose" && (
            <Button size="icon" variant="secondary" className="rounded-full" onClick={() => setStep({ kind: "choose" })} aria-label="Start over">
              <X />
            </Button>
          )
        }
      />
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="px-5">
        {step.kind === "choose" && (
          <div className="space-y-3">
            <Option icon={FileUp} title="Upload PDF or image" description="E-tickets, boarding passes, hotel confirmations, screenshots. We read the barcode and text." onClick={() => fileInput.current?.click()} />
            <Option icon={ScanLine} title="Scan a QR or barcode" description="Use the camera on a printed or on-screen ticket." onClick={() => setStep({ kind: "camera" })} />
            <Option icon={Keyboard} title="Enter manually" description="Type in the details yourself." onClick={() => setStep({ kind: "review", draft: {}, summary: "" })} />
            <p className="px-1 pt-2 text-xs text-muted-foreground">
              Everything is parsed on your phone. Only the file and the details you save are synced to your backend.
            </p>
          </div>
        )}

        {step.kind === "camera" && <CameraScanner onResult={onScan} />}

        {step.kind === "working" && (
          <Card className="flex flex-col items-center gap-3 py-14 text-center">
            <Loader2 className="size-8 animate-spin text-star" />
            <p className="text-sm text-muted-foreground">{step.status}</p>
          </Card>
        )}

        {step.kind === "review" && (
          <div className="space-y-5">
            {step.preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={step.preview} alt="Ticket preview" className="max-h-56 w-full rounded-2xl border bg-white object-contain" />
            )}
            {step.match && (
              <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
                <p className="text-sm font-semibold">This looks like the boarding pass for a booking you saved</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {step.match.title} · {fmtDay(step.match.departureAt) ?? "no date"}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => attachToBooking(step.match!)} disabled={save.isPending}>
                    Attach to booking
                  </Button>
                  <Button variant="ghost" onClick={() => setStep({ ...step, match: null })}>
                    Save as new
                  </Button>
                </div>
              </div>
            )}
            {!step.match && step.related && step.related.length > 0 && step.file && (
              <AttachToExisting
                key={step.file.name}
                file={step.file}
                draft={step.draft}
                extras={step.extras}
                related={step.related}
                onDismiss={() => setStep({ ...step, related: [] })}
                onDone={(id) => router.replace(`/tickets/${id}`)}
              />
            )}
            {step.summary && <p className="rounded-2xl bg-star/10 px-4 py-3 text-sm text-star">{step.summary}</p>}
            <TicketForm initial={step.draft} onSubmit={onSubmit} submitLabel="Add to wallet" />
          </div>
        )}
      </div>
    </>
  );
}

function Option({ icon: Icon, title, description, onClick }: { icon: typeof Camera; title: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 rounded-3xl border bg-card p-5 text-left shadow-sm transition active:scale-[0.99]">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Icon className="size-6" />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

/**
 * Offers to add the file to a ticket you already have (an extra-baggage receipt, a seat
 * upgrade, a re-sent confirmation) instead of creating a duplicate, and to copy over what it adds.
 */
function AttachToExisting({
  file,
  draft,
  extras,
  related,
  onDismiss,
  onDone,
}: {
  file: File;
  draft: TicketDraft;
  extras?: Extras;
  related: TicketMatch[];
  onDismiss: () => void;
  onDone: (ticketId: string) => void;
}) {
  const add = useAddAttachments();
  const save = useSaveTicket();
  const found = draft as Partial<TicketValues>;
  const defaultsFor = (t: Ticket) => ({
    kind: (extras?.kind ?? (found.type === t.type ? "booking" : "receipt")) as Attachment["kind"],
    suggestions: mergeSuggestions(t, found, extras ?? null),
  });
  const [picked, setPicked] = useState(0);
  const [kind, setKind] = useState(() => defaultsFor(related[0].ticket).kind);
  const [label, setLabel] = useState(extras?.label ?? "");
  const [suggestions, setSuggestions] = useState<MergeSuggestion[]>(() => defaultsFor(related[0].ticket).suggestions);
  const [busy, setBusy] = useState(false);
  const target = related[picked].ticket;

  function choose(i: number) {
    setPicked(i);
    const d = defaultsFor(related[i].ticket);
    setKind(d.kind);
    setSuggestions(d.suggestions);
  }

  async function attach() {
    setBusy(true);
    try {
      const attachment = await uploadAttachment(file, kind, label);
      const updated = await add.mutateAsync({ id: target.id, attachments: [attachment] });
      const chosen = suggestions.filter((s) => s.checked);
      if (chosen.length) await save.mutateAsync({ id: target.id, values: applySuggestions(updated, chosen, found) });
      toast.success(`Added to ${target.title}`);
      onDone(target.id);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Couldn't attach the file");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-primary/40 bg-primary/10 p-4">
      <div className="flex items-start gap-2">
        <Link2 className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">This looks like it goes with a ticket you already have</p>
          <p className="text-sm text-muted-foreground">Add it there as a file instead of creating a new ticket?</p>
        </div>
      </div>

      <div className="space-y-2">
        {related.map((m, i) => (
          <button
            key={m.ticket.id}
            onClick={() => choose(i)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition",
              i === picked ? "border-primary ring-2 ring-primary/30" : "opacity-80",
            )}
          >
            <span className={cn("size-4 shrink-0 rounded-full border-2", i === picked ? "border-primary bg-primary" : "border-muted-foreground/40")} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{m.ticket.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {fmtDay(m.ticket.departureAt) ?? "No date"} · {m.reason}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
        <div className="space-y-1">
          <Label htmlFor="attach-kind" className="text-xs text-muted-foreground">Type</Label>
          <NativeSelect id="attach-kind" value={kind} onChange={(e) => setKind(e.target.value as Attachment["kind"])}>
            {kindOptions(kind)}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="attach-label" className="text-xs text-muted-foreground">Label (optional)</Label>
          <Input id="attach-label" value={label} placeholder={KIND_LABEL[kind]} maxLength={120} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>

      <SuggestionChecklist
        suggestions={suggestions}
        onToggle={(key) => setSuggestions((list) => list.map((s) => (s.key === key ? { ...s, checked: !s.checked } : s)))}
      />

      <div className="flex gap-2">
        <Button className="flex-1" onClick={attach} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Add to this ticket
        </Button>
        <Button variant="ghost" onClick={onDismiss} disabled={busy}>
          Save as new
        </Button>
      </div>
    </div>
  );
}
