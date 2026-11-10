"use client";

import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import type { DecodedBarcode } from "@/lib/parse/extract";
import { zxingFormatName } from "@/lib/parse/extract";

/** Live camera barcode scanner (QR, PDF417, Aztec, Data Matrix, Code 128). */
export function CameraScanner({ onResult }: { onResult: (code: DecodedBarcode) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let cancelled = false;
    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, lib] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        const hints = new Map();
        hints.set(lib.DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
          videoRef.current!,
          (result) => {
            if (!result || done.current) return;
            done.current = true;
            navigator.vibrate?.(40);
            onResult({ data: result.getText(), format: zxingFormatName(result.getBarcodeFormat(), lib) });
            controls?.stop();
          },
        );
        if (cancelled) controls.stop();
      } catch (e) {
        setError(e instanceof Error && e.name === "NotAllowedError" ? "Camera permission was denied." : "Couldn't start the camera.");
      }
    })();
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onResult]);

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-black">
      <video ref={videoRef} className="size-full object-cover" playsInline muted autoPlay />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="aspect-square w-2/3 rounded-3xl border-2 border-star/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
      </div>
      <p className="absolute inset-x-0 bottom-4 text-center text-sm text-white/90">
        {error ?? "Point at the QR or barcode on your ticket"}
      </p>
    </div>
  );
}
