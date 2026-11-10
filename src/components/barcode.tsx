"use client";

import { useMemo } from "react";
import { toSVG } from "bwip-js/browser";
import type { BarcodeFormat } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Re-renders the ticket's barcode from its data, so it is always crisp and works offline. */
export function Barcode({ data, format, className }: { data: string; format: BarcodeFormat | null; className?: string }) {
  const svg = useMemo(() => {
    const bcid = format ?? "qrcode";
    try {
      return toSVG({
        bcid,
        text: data,
        scale: 3,
        paddingwidth: 0,
        paddingheight: 0,
        ...(bcid === "pdf417" ? { columns: 6, rowmult: 2 } : {}),
        ...(bcid === "code128" || bcid === "ean13" ? { height: 18, includetext: true } : {}),
      });
    } catch {
      return null;
    }
  }, [data, format]);

  if (!svg) return <p className="break-all font-mono text-xs text-black/70">{data}</p>;
  const square = format === "qrcode" || format === "azteccode" || format === "datamatrix" || !format;
  return (
    <div
      className={cn("[&>svg]:h-auto [&>svg]:w-full", square ? "mx-auto max-w-[240px]" : "w-full", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
