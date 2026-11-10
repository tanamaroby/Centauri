"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileUp, Loader2, ScanLine } from "lucide-react";
import { CameraScanner } from "@/components/camera-scanner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { uploadAttachment, useSaveTicket } from "@/lib/client-api";
import { fieldsFrom, type DecodedBarcode } from "@/lib/parse/extract";
import { boardingPassPatch } from "@/lib/tickets";
import type { Attachment, Ticket, TicketValues } from "@/lib/types";

type Mode = "choose" | "camera" | "working";

/** Adds a boarding pass (file or scanned code) to a booking, or marks it checked in at the counter. */
export function AddBoardingPass({ ticket, open, onOpenChange }: { ticket: Ticket; open: boolean; onOpenChange: (open: boolean) => void }) {
  const save = useSaveTicket();
  const [mode, setMode] = useState<Mode>("choose");
  const [status, setStatus] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  function close() {
    onOpenChange(false);
    setMode("choose");
  }

  async function apply(pass: Partial<TicketValues>, file?: Attachment) {
    await save.mutateAsync({ id: ticket.id, values: boardingPassPatch(ticket, pass, file) });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMode("working");
    setStatus("Reading boarding pass…");
    try {
      const { extractFromFile } = await import("@/lib/parse/extract");
      const result = await extractFromFile(file, { onStatus: setStatus });
      setStatus("Uploading…");
      let attachment: Attachment | undefined;
      try {
        attachment = await uploadAttachment(file, "boarding");
      } catch (e) {
        console.error(e);
        toast.warning("Couldn't store the file, saving the details anyway.");
      }
      await apply(result.fields, attachment);
      toast.success(result.fields.barcodeData ? "Boarding pass added" : "File added. No barcode found, so check the details.");
      close();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Couldn't add the boarding pass");
      setMode("choose");
    }
  }

  async function onScan(code: DecodedBarcode) {
    setMode("working");
    setStatus("Saving…");
    try {
      await apply(fieldsFrom("", [code]));
      toast.success("Boarding pass added");
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
      setMode("choose");
    }
  }

  async function markCounter() {
    try {
      await save.mutateAsync({ id: ticket.id, values: { checkedIn: true } });
      toast.success("Marked as checked in");
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    }
  }

  return (
    <Drawer open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Add boarding pass</DrawerTitle>
          <DrawerDescription>The barcode, seat and gate are added to this booking.</DrawerDescription>
        </DrawerHeader>
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
        <div className="space-y-3 px-4 pb-8">
          {mode === "choose" && (
            <>
              <Choice icon={FileUp} title="Upload PDF or screenshot" description="From the airline app, email or online check-in." onClick={() => fileInput.current?.click()} />
              <Choice icon={ScanLine} title="Scan the barcode" description="Point the camera at a printed or on-screen pass." onClick={() => setMode("camera")} />
              <Choice icon={CheckCircle2} title="Checked in at the counter" description="Paper pass only. Just mark this flight as checked in." onClick={markCounter} />
            </>
          )}
          {mode === "camera" && (
            <>
              <CameraScanner onResult={onScan} />
              <Button variant="ghost" className="w-full" onClick={() => setMode("choose")}>
                Cancel
              </Button>
            </>
          )}
          {mode === "working" && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2 className="size-8 animate-spin text-star" />
              <p className="text-sm text-muted-foreground">{status}</p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Choice({ icon: Icon, title, description, onClick }: { icon: typeof FileUp; title: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left transition active:scale-[0.99]">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
