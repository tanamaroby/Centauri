"use client";

import type { BarcodeFormat as ZxingFormat } from "@zxing/library";
import type { BarcodeFormat, TicketValues } from "@/lib/types";
import { bcbpToTicket } from "./bcbp";
import { buildTitle, parseTicketText } from "./text";

export type DecodedBarcode = { data: string; format: BarcodeFormat };

export type Extraction = {
  text: string;
  barcodes: DecodedBarcode[];
  fields: Partial<TicketValues>;
  /** Small preview of the first page/image (data URL). */
  preview?: string;
};

const ZXING_TO_BWIP: Record<string, BarcodeFormat> = {
  QR_CODE: "qrcode",
  PDF_417: "pdf417",
  AZTEC: "azteccode",
  DATA_MATRIX: "datamatrix",
  CODE_128: "code128",
  EAN_13: "ean13",
};

let readerPromise: Promise<import("@zxing/browser").BrowserMultiFormatReader> | undefined;
async function getReader() {
  return (readerPromise ??= (async () => {
    const [{ BrowserMultiFormatReader }, lib] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
    const hints = new Map();
    hints.set(lib.DecodeHintType.POSSIBLE_FORMATS, [
      lib.BarcodeFormat.QR_CODE,
      lib.BarcodeFormat.PDF_417,
      lib.BarcodeFormat.AZTEC,
      lib.BarcodeFormat.DATA_MATRIX,
      lib.BarcodeFormat.CODE_128,
    ]);
    hints.set(lib.DecodeHintType.TRY_HARDER, true);
    return new BrowserMultiFormatReader(hints);
  })());
}

export function zxingFormatName(format: ZxingFormat, lib: typeof import("@zxing/library")): BarcodeFormat {
  return ZXING_TO_BWIP[lib.BarcodeFormat[format]] ?? "qrcode";
}

/** Try decoding at a few scales; ZXing is sensitive to module size. */
async function decodeCanvas(canvas: HTMLCanvasElement): Promise<DecodedBarcode | null> {
  const reader = await getReader();
  const lib = await import("@zxing/library");
  const attempt = (c: HTMLCanvasElement) => {
    try {
      const r = reader.decodeFromCanvas(c);
      return { data: r.getText(), format: zxingFormatName(r.getBarcodeFormat(), lib) };
    } catch {
      return null;
    }
  };
  const direct = attempt(canvas);
  if (direct) return direct;
  for (const scale of [0.5, 1.6]) {
    const c = document.createElement("canvas");
    c.width = Math.round(canvas.width * scale);
    c.height = Math.round(canvas.height * scale);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = scale < 1;
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
    const hit = attempt(c);
    if (hit) return hit;
  }
  return null;
}

function toPreview(canvas: HTMLCanvasElement) {
  const max = 900;
  const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const c = document.createElement("canvas");
  c.width = Math.round(canvas.width * scale);
  c.height = Math.round(canvas.height * scale);
  c.getContext("2d")!.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

async function extractPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const texts: string[] = [];
  const barcodes: DecodedBarcode[] = [];
  let preview: string | undefined;

  for (let i = 1; i <= Math.min(doc.numPages, 4); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Rebuild lines using the y coordinate so labels stay next to their values.
    let lastY: number | null = null;
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        lines.push(line.trim());
        line = "";
      }
      line += (line && !line.endsWith(" ") ? "  " : "") + item.str;
      lastY = y;
    }
    if (line) lines.push(line.trim());
    texts.push(lines.join("\n"));

    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, viewport }).promise;
    if (i === 1) preview = toPreview(canvas);
    const code = await decodeCanvas(canvas);
    if (code && !barcodes.some((b) => b.data === code.data)) barcodes.push(code);
  }
  return { text: texts.join("\n\n"), barcodes, preview };
}

async function fileToCanvas(file: Blob) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

async function ocr(canvas: HTMLCanvasElement, onProgress?: (p: number) => void) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m) => m.status === "recognizing text" && onProgress?.(m.progress),
  });
  try {
    const { data } = await worker.recognize(canvas);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

export async function extractFromFile(
  file: File,
  opts: { ocr?: boolean; onStatus?: (s: string) => void } = {},
): Promise<Extraction> {
  const { onStatus } = opts;
  let text = "";
  let barcodes: DecodedBarcode[] = [];
  let preview: string | undefined;

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    onStatus?.("Reading PDF…");
    ({ text, barcodes, preview } = await extractPdf(file));
  } else {
    onStatus?.("Looking for a barcode…");
    const canvas = await fileToCanvas(file);
    preview = toPreview(canvas);
    const code = await decodeCanvas(canvas);
    if (code) barcodes = [code];
    // Skip OCR when the barcode already tells us everything (boarding passes).
    const isBoardingPass = code && /^M[1-4]/.test(code.data);
    if (opts.ocr !== false && !isBoardingPass) {
      onStatus?.("Reading text…");
      text = await ocr(canvas, (p) => onStatus?.(`Reading text… ${Math.round(p * 100)}%`)).catch(() => "");
    }
  }

  return { text, barcodes, preview, fields: fieldsFrom(text, barcodes) };
}

/** Merge what the barcode and the text tell us; the barcode wins on conflicts. */
export function fieldsFrom(text: string, barcodes: DecodedBarcode[]): Partial<TicketValues> {
  const fromText = text ? parseTicketText(text) : {};
  const primary = barcodes[0];
  const fromBarcode = primary ? (bcbpToTicket(primary.data) ?? {}) : {};
  const merged: Partial<TicketValues> = { ...fromText, ...fromBarcode };
  // Keep the time from the text if the barcode only knew the date.
  if (fromBarcode.departureAt && fromText.departureAt?.startsWith(fromBarcode.departureAt)) {
    merged.departureAt = fromText.departureAt;
  }
  if (primary) {
    merged.barcodeData = primary.data;
    merged.barcodeFormat = primary.format;
  }
  if (!merged.title || merged.title === "New ticket") merged.title = buildTitle(merged, text);
  return merged;
}
