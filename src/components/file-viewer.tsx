"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Full-screen in-app viewer for a ticket's original file. Opening the file in a new tab
 * strands you in an iOS home-screen app (no browser chrome to go back), so we render it here.
 */
export function FileViewer({ src, name, type, onClose }: { src: string; name: string; type: string | null; onClose: () => void }) {
  const isPdf = type === "application/pdf" || name.toLowerCase().endsWith(".pdf");
  const pagesRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">(isPdf ? "loading" : "ready");
  const [blob, setBlob] = useState<Blob | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.blob();
        if (cancelled) return;
        setBlob(data);
        if (!isPdf) return;
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await data.arrayBuffer()) }).promise;
        const container = pagesRef.current;
        if (!container || cancelled) return;
        container.replaceChildren();
        const width = Math.min(container.clientWidth, 900);
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = (width / base.width) * Math.min(window.devicePixelRatio || 2, 3);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "w-full h-auto rounded-lg bg-white shadow-lg";
          await page.render({ canvas, viewport }).promise;
          if (cancelled) return;
          container.appendChild(canvas);
          if (i === 1) setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, isPdf]);

  async function share() {
    if (!blob) return;
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name }).catch(() => {});
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/95 pt-safe pb-safe" role="dialog" aria-modal aria-label={name}>
      <div className="flex items-center gap-2 px-3 py-2 text-white">
        <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/10" onClick={onClose} aria-label="Close">
          <X className="size-6" />
        </Button>
        <div className="min-w-0 flex-1 truncate text-sm font-medium">{name}</div>
        <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/10" onClick={share} disabled={!blob} aria-label="Share or save">
          <Share className="size-5" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-6">
        {state === "loading" && (
          <div className="flex h-full items-center justify-center text-white/70">
            <Loader2 className="size-8 animate-spin" />
          </div>
        )}
        {state === "error" && <p className="pt-20 text-center text-sm text-white/70">Couldn&apos;t open this file. Are you offline?</p>}
        {isPdf ? (
          <div ref={pagesRef} className="mx-auto flex max-w-[900px] flex-col gap-3" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className="mx-auto max-h-full w-auto max-w-full rounded-lg object-contain" onError={() => setState("error")} />
        )}
      </div>
    </div>
  );
}
