"use client";
import { useRef, useState } from "react";
import { ImageUp, LoaderCircle } from "lucide-react";
import { useI18n } from "../../lib/i18n/provider.tsx";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Reads a screenshot of a bank SMS or UPI receipt on this device (Tesseract
 * WebAssembly, assets served from /ocr on the app's own origin) and hands the
 * text to the composer. The image is never uploaded.
 */
export function ScreenshotReader({ onText }: { onText: (text: string) => void }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "error" | "empty">("idle");

  async function read(file: File) {
    if (!file.type.startsWith("image/") || file.size > MAX_BYTES) {
      setStatus("error");
      return;
    }
    setStatus("reading");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/",
        langPath: "/ocr/",
        gzip: true,
        workerBlobURL: false,
      });
      try {
        const { data } = await worker.recognize(file);
        const text = data.text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
        if (text) {
          onText(text);
          setStatus("idle");
        } else setStatus("empty");
      } finally {
        await worker.terminate();
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="screenshot-reader">
      <button
        type="button"
        className="button ghost"
        disabled={status === "reading"}
        onClick={() => input.current?.click()}
        title={t("composer.screenshotHint")}
      >
        {status === "reading" ? <LoaderCircle className="spin" size={14} /> : <ImageUp size={14} />}
        {status === "reading" ? t("composer.screenshotReading") : t("composer.screenshot")}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void read(file);
        }}
      />
      {status === "error" && <span role="status">{t("composer.screenshotError")}</span>}
      {status === "empty" && <span role="status">{t("composer.screenshotEmpty")}</span>}
    </div>
  );
}
