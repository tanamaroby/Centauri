"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, FileUp, Keyboard, Loader2, ScanLine, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { TicketForm, type TicketDraft } from "@/components/ticket-form";
import { CameraScanner } from "@/components/camera-scanner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { uploadTicketFile, useSaveTicket } from "@/lib/client-api";
import { fieldsFrom, type DecodedBarcode } from "@/lib/parse/extract";
import { bcbpToTicket } from "@/lib/parse/bcbp";

type Step =
  | { kind: "choose" }
  | { kind: "camera" }
  | { kind: "working"; status: string }
  | { kind: "review"; draft: TicketDraft; file?: File; preview?: string; summary: string };

export function AddTicket() {
  const router = useRouter();
  const save = useSaveTicket();
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setStep({ kind: "working", status: "Opening file…" });
    try {
      const { extractFromFile } = await import("@/lib/parse/extract");
      const result = await extractFromFile(file, { onStatus: (status) => setStep({ kind: "working", status }) });
      let aiNote: string | null = null;
      if (result.text.trim()) {
        setStep({ kind: "working", status: "Reading with AI…" });
        const ai = await aiRead(result.text, result.barcodes[0]?.data);
        if (ai.fields) result.fields = mergeAi(result.fields, ai.fields, result.barcodes[0]?.data);
        else if (ai.error) aiNote = ai.error;
      }
      const found = [
        result.barcodes.length ? `${result.barcodes[0].format.toUpperCase()} code` : null,
        result.fields.departureAt ? "date" : null,
        result.fields.bookingRef ? "booking ref" : null,
      ].filter(Boolean);
      setStep({
        kind: "review",
        draft: result.fields,
        file,
        preview: result.preview,
        summary:
          (found.length ? `Found ${found.join(", ")}. Check the details below.` : "Couldn't read much from this file. Fill in the details below.") +
          (aiNote ? ` (${aiNote})` : ""),
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
      summary: draft.type === "flight" ? "Boarding pass scanned. Add the departure time if needed." : "Code scanned. Add the details below.",
    });
  }, []);

  async function onSubmit(values: TicketDraft) {
    if (step.kind !== "review") return;
    try {
      let fileFields = {};
      if (step.file) {
        const t = toast.loading("Uploading file…");
        try {
          fileFields = await uploadTicketFile(step.file);
        } catch (e) {
          console.error(e);
          toast.warning("Couldn't store the original file (is Vercel Blob set up?). Saving the ticket details anyway.");
        } finally {
          toast.dismiss(t);
        }
      }
      const ticket = await save.mutateAsync({ values: { ...values, ...fileFields } });
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
            <Option icon={FileUp} title="Upload PDF or image" description="E-tickets, boarding passes, screenshots. We read the barcode and text." onClick={() => fileInput.current?.click()} />
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
            {step.summary && <p className="rounded-2xl bg-star/10 px-4 py-3 text-sm text-star">{step.summary}</p>}
            <TicketForm initial={step.draft} onSubmit={onSubmit} submitLabel="Add to wallet" />
          </div>
        )}
      </div>
    </>
  );
}

/** Ask the server to read the ticket text with an LLM (Neon AI Gateway). Never throws. */
async function aiRead(text: string, barcode?: string): Promise<{ fields?: TicketDraft; error?: string }> {
  try {
    const res = await fetch("/api/ai/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 30_000), barcode, today: new Date().toISOString().slice(0, 10) }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { fields: body.fields };
    // 501 = AI not configured: stay quiet and use on-device parsing only.
    return res.status === 501 ? {} : { error: body.error ?? "AI reading unavailable" };
  } catch {
    return {};
  }
}

/** AI beats text heuristics; boarding-pass barcode data beats both. */
function mergeAi(local: TicketDraft, ai: TicketDraft, barcode?: string): TicketDraft {
  const fromBarcode = barcode ? (bcbpToTicket(barcode) ?? {}) : {};
  const merged: TicketDraft = { ...local, ...ai, ...fromBarcode };
  if (fromBarcode.departureAt && ai.departureAt?.startsWith(fromBarcode.departureAt)) merged.departureAt = ai.departureAt;
  return merged;
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
