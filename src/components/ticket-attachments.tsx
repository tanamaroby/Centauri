"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileImage, FileText, Loader2, MoreHorizontal, Paperclip, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useAddAttachments, useRemoveAttachment, useSaveTicket, useUpdateAttachment, uploadAttachment } from "@/lib/client-api";
import { applySuggestions, attachmentTitle, EXTRA_KINDS, KIND_LABEL, mergeSuggestions, ticketFiles, type MergeSuggestion } from "@/lib/tickets";
import { ATTACHMENT_KINDS, type Attachment, type Ticket, type TicketValues } from "@/lib/types";
import { cn } from "@/lib/utils";

const isImage = (a: Pick<Attachment, "type" | "name">) => a.type?.startsWith("image/") || /\.(png|jpe?g|heic|webp|gif)$/i.test(a.name);
const addedOn = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null;

/** The ticket's files: the original ticket plus receipts, baggage, add-ons bought later, etc. */
export function TicketAttachments({ ticket, onView }: { ticket: Ticket; onView: (a: Attachment) => void }) {
  const files = ticketFiles(ticket);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Attachment | null>(null);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Files{files.length > 0 && <span className="ml-1 font-normal">· {files.length}</span>}
        </h2>
        <Button variant="ghost" size="sm" className="h-8 text-primary" onClick={() => setAdding(true)}>
          <Plus /> Add
        </Button>
      </div>

      {files.length === 0 ? (
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground"
        >
          <Paperclip className="size-4" /> Add a receipt, baggage purchase or other file
        </button>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          {files.map((f, i) => {
            const Icon = isImage(f) ? FileImage : FileText;
            const meta = [KIND_LABEL[f.kind], addedOn(f.addedAt)].filter(Boolean).join(" · ");
            return (
              <div key={f.url} className={cn("flex items-center", i > 0 && "border-t")}>
                <button onClick={() => onView(f)} className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left">
                  <Icon className="size-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{f.label || f.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{f.label ? `${meta} · ${f.name}` : meta}</div>
                  </div>
                </button>
                <Button variant="ghost" size="icon" className="mr-2 shrink-0 rounded-full" onClick={() => setEditing(f)} aria-label={`Edit ${attachmentTitle(f)}`}>
                  <MoreHorizontal />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <AddAttachments ticket={ticket} open={adding} onOpenChange={setAdding} />
      <EditAttachment ticket={ticket} attachment={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

type Picked = { file: File; kind: Attachment["kind"]; label: string };
type Step =
  | { kind: "choose" }
  | { kind: "reading"; status: string }
  | { kind: "review"; picked: Picked[]; suggestions: MergeSuggestion[]; found: Partial<TicketValues> }
  | { kind: "saving"; status: string };

function AddAttachments({ ticket, open, onOpenChange }: { ticket: Ticket; open: boolean; onOpenChange: (o: boolean) => void }) {
  const add = useAddAttachments();
  const save = useSaveTicket();
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const [readFiles, setReadFiles] = useState(true);
  const skip = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  function close() {
    onOpenChange(false);
    setStep({ kind: "choose" });
  }

  async function onPick(list: FileList | null) {
    const files = [...(list ?? [])].slice(0, 10);
    if (!files.length) return;
    const picked: Picked[] = files.map((file) => ({ file, kind: "receipt", label: "" }));
    let found: Partial<TicketValues> = {};
    let suggestions: MergeSuggestion[] = [];
    if (readFiles) {
      skip.current = false;
      const [{ extractFromFile }, { parseExtras }] = await Promise.all([import("@/lib/parse/extract"), import("@/lib/parse/extras")]);
      for (const [i, p] of picked.entries()) {
        if (skip.current) break;
        const prefix = files.length > 1 ? `File ${i + 1} of ${files.length}: ` : "";
        setStep({ kind: "reading", status: `${prefix}Reading…` });
        try {
          const result = await extractFromFile(p.file, { onStatus: (s) => setStep({ kind: "reading", status: prefix + s }) });
          if (skip.current) break;
          const extras = parseExtras(result.text);
          p.kind = extras.kind ?? (result.fields.barcodeData ? "other" : "receipt");
          p.label = extras.label ?? "";
          // Earlier files win when two files disagree.
          found = { ...result.fields, ...found };
          suggestions = combine(suggestions, mergeSuggestions(ticket, result.fields, extras));
        } catch (e) {
          console.warn("[centauri] couldn't read attachment", e);
        }
      }
    }
    setStep({ kind: "review", picked, suggestions, found });
  }

  async function onSave() {
    if (step.kind !== "review") return;
    const { picked, suggestions, found } = step;
    try {
      const uploaded: Attachment[] = [];
      for (const [i, p] of picked.entries()) {
        setStep({ kind: "saving", status: picked.length > 1 ? `Uploading ${i + 1} of ${picked.length}…` : "Uploading…" });
        uploaded.push(await uploadAttachment(p.file, p.kind, p.label));
      }
      setStep({ kind: "saving", status: "Saving…" });
      const updated = await add.mutateAsync({ id: ticket.id, attachments: uploaded });
      const chosen = suggestions.filter((s) => s.checked);
      if (chosen.length) await save.mutateAsync({ id: ticket.id, values: applySuggestions(updated, chosen, found) });
      toast.success(
        `${uploaded.length === 1 ? "File" : `${uploaded.length} files`} added${chosen.length ? " and ticket updated" : ""}`,
      );
      close();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Couldn't add the file");
      setStep({ kind: "review", picked, suggestions, found });
    }
  }

  function updatePicked(i: number, patch: Partial<Picked>) {
    if (step.kind !== "review") return;
    setStep({ ...step, picked: step.picked.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  }

  function toggle(key: MergeSuggestion["key"]) {
    if (step.kind !== "review") return;
    setStep({ ...step, suggestions: step.suggestions.map((s) => (s.key === key ? { ...s, checked: !s.checked } : s)) });
  }

  return (
    <Drawer open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())} repositionInputs={false}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Add files</DrawerTitle>
          <DrawerDescription>Receipts, extra baggage, seat or meal add-ons, anything that belongs to this booking.</DrawerDescription>
        </DrawerHeader>
        <input
          ref={input}
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 pb-8">
          {step.kind === "choose" && (
            <>
              <button
                onClick={() => input.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed bg-card p-6 text-center"
              >
                <Paperclip className="size-6 text-primary" />
                <span className="font-semibold">Choose PDFs or screenshots</span>
                <span className="text-sm text-muted-foreground">You can pick several at once.</span>
              </button>
              <label className="flex items-start gap-3 rounded-2xl border bg-card p-4">
                <input type="checkbox" className="mt-1 size-4 accent-primary" checked={readFiles} onChange={(e) => setReadFiles(e.target.checked)} />
                <span>
                  <span className="block font-medium">Read details from the files</span>
                  <span className="block text-sm text-muted-foreground">Suggests a label, and offers to add things like baggage allowance or a seat to this ticket.</span>
                </span>
              </label>
            </>
          )}

          {(step.kind === "reading" || step.kind === "saving") && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2 className="size-8 animate-spin text-star" />
              <p className="text-sm text-muted-foreground">{step.status}</p>
              {step.kind === "reading" && (
                <Button variant="ghost" size="sm" onClick={() => (skip.current = true)}>
                  Skip reading
                </Button>
              )}
            </div>
          )}

          {step.kind === "review" && (
            <>
              {step.picked.map((p, i) => (
                <div key={i} className="space-y-3 rounded-2xl border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.file.name}</span>
                    {step.picked.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-full"
                        aria-label="Don't add this file"
                        onClick={() => setStep({ ...step, picked: step.picked.filter((_, j) => j !== i) })}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`kind-${i}`} className="text-xs text-muted-foreground">Type</Label>
                      <NativeSelect id={`kind-${i}`} value={p.kind} onChange={(e) => updatePicked(i, { kind: e.target.value as Attachment["kind"] })}>
                        {kindOptions(p.kind)}
                      </NativeSelect>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`label-${i}`} className="text-xs text-muted-foreground">Label (optional)</Label>
                      <Input id={`label-${i}`} value={p.label} placeholder="e.g. Extra 20 kg" maxLength={120} onChange={(e) => updatePicked(i, { label: e.target.value })} />
                    </div>
                  </div>
                </div>
              ))}

              {step.suggestions.length > 0 && (
                <div className="rounded-2xl border bg-card">
                  <div className="p-4 pb-2">
                    <div className="font-semibold">Update this ticket?</div>
                    <p className="text-sm text-muted-foreground">Found in the file. Untick anything that&apos;s wrong.</p>
                  </div>
                  {step.suggestions.map((s) => (
                    <label key={s.key} className="flex items-start gap-3 border-t px-4 py-3">
                      <input type="checkbox" className="mt-1 size-4 accent-primary" checked={s.checked} onChange={() => toggle(s.key)} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-muted-foreground">{s.label}</span>
                        <span className="block whitespace-pre-wrap break-words font-medium">{s.value}</span>
                        {s.current && <span className="block text-xs text-muted-foreground">Replaces {s.current}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setStep({ kind: "choose" })}>
                  Back
                </Button>
                <Button className="flex-1" onClick={onSave} disabled={!step.picked.length}>
                  Add {step.picked.length > 1 ? `${step.picked.length} files` : "file"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Merges suggestions from several files: the first file wins per field, note lines add up. */
function combine(a: MergeSuggestion[], b: MergeSuggestion[]) {
  const out = [...a];
  for (const s of b) {
    const i = out.findIndex((x) => x.key === s.key);
    if (i < 0) out.push(s);
    else if (s.key === "notes") out[i] = { ...out[i], value: `${out[i].value}\n${s.value}` };
  }
  return out;
}

/** Boarding passes are added through their own flow, but an existing one can keep its kind. */
function kindOptions(current: Attachment["kind"]) {
  const kinds = EXTRA_KINDS.includes(current) ? EXTRA_KINDS : [current, ...EXTRA_KINDS];
  return kinds.map((k) => (
    <option key={k} value={k}>
      {KIND_LABEL[k]}
    </option>
  ));
}

function EditAttachment({ ticket, attachment, onClose }: { ticket: Ticket; attachment: Attachment | null; onClose: () => void }) {
  const update = useUpdateAttachment();
  const remove = useRemoveAttachment();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<Attachment["kind"]>("other");
  const [shownFor, setShownFor] = useState<string | null>(null);

  // Reset the form whenever a different file is opened.
  if (attachment && shownFor !== attachment.url) {
    setShownFor(attachment.url);
    setLabel(attachment.label ?? "");
    setKind(attachment.kind);
  }

  async function onSave() {
    if (!attachment) return;
    try {
      await update.mutateAsync({ id: ticket.id, url: attachment.url, label, kind });
      toast.success("Saved");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    }
  }

  async function onRemove() {
    if (!attachment || !confirm(`Remove "${attachment.label || attachment.name}"? The file is deleted.`)) return;
    try {
      await remove.mutateAsync({ id: ticket.id, url: attachment.url });
      toast.success("File removed");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove the file");
    }
  }

  const busy = update.isPending || remove.isPending;
  return (
    <Drawer open={!!attachment} onOpenChange={(o) => !o && onClose()} repositionInputs={false}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Edit file</DrawerTitle>
          <DrawerDescription className="truncate">{attachment?.name}</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 px-4 pb-8">
          <div className="space-y-1.5">
            <Label htmlFor="att-label">Label</Label>
            <Input id="att-label" value={label} placeholder="e.g. Seat upgrade" maxLength={120} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="att-kind">Type</Label>
            <NativeSelect id="att-kind" value={kind} onChange={(e) => setKind(e.target.value as Attachment["kind"])}>
              {ATTACHMENT_KINDS.filter((k) => k !== "boarding" || kind === "boarding").map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button className="w-full" onClick={onSave} disabled={busy}>
            {update.isPending && <Loader2 className="animate-spin" />} Save
          </Button>
          <Button variant="ghost" className="w-full text-destructive" onClick={onRemove} disabled={busy}>
            {remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove file
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
