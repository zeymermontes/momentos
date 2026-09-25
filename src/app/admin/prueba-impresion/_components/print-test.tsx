"use client";

import { useRef, useState } from "react";
import { Download, Loader2, RotateCcw, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { optimizeImage } from "@/lib/image-optimize";
import { getSheetLayout, PRINT_DPI, SHEET_H_PX, SHEET_W_PX } from "@/lib/print-sheets";
import {
  SHEET_COLOR_SPACE,
  SHEET_JPEG_QUALITY,
  canvasToBlob,
  drawBookPage,
  exportSheetJpeg,
} from "@/lib/print-render";
import { embedSrgbProfile, readJpegIccDescription } from "@/lib/srgb-icc";
import { DEFAULT_CROP } from "@/lib/photobook-config";

type Size = { cm: number; label: string };

/**
 * Every knob of the print pipeline that can plausibly change how a photo
 * comes out on paper. The defaults are exactly what generate-sheets.tsx does.
 */
type Params = {
  /** Run the upload optimizer (passthrough for JPEG/PNG/WebP, re-encode for HEIC). */
  optimize: boolean;
  colorSpace: PredefinedColorSpace;
  /** Embed the sRGB profile in the JPEG. Only meaningful for sRGB + JPEG. */
  embedIcc: boolean;
  format: "jpeg" | "png";
  /** JPEG quality 0.5–1. */
  quality: number;
  /** CSS filter multipliers, 1 = untouched. */
  brightness: number;
  contrast: number;
  saturation: number;
};

const REAL_PIPELINE: Params = {
  optimize: true,
  colorSpace: SHEET_COLOR_SPACE,
  embedIcc: true,
  format: "jpeg",
  quality: SHEET_JPEG_QUALITY,
  brightness: 1,
  contrast: 1,
  saturation: 1,
};

type Original = {
  url: string;
  name: string;
  type: string;
  bytes: number;
  width: number | null;
  height: number | null;
  icc: string | null;
};

type Processed = {
  url: string;
  name: string;
  bytes: number;
  pagePx: number;
  passthrough: boolean;
  uploadedType: string;
  icc: string | null;
  params: Params;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function isRealPipeline(p: Params): boolean {
  return (Object.keys(REAL_PIPELINE) as (keyof Params)[]).every((k) => p[k] === REAL_PIPELINE[k]);
}

function filterFor(p: Params): string {
  const parts: string[] = [];
  if (p.brightness !== 1) parts.push(`brightness(${p.brightness})`);
  if (p.contrast !== 1) parts.push(`contrast(${p.contrast})`);
  if (p.saturation !== 1) parts.push(`saturate(${p.saturation})`);
  return parts.length ? parts.join(" ") : "none";
}

/** One-line human summary, printed on the comparison sheet. */
function describeParams(p: Params, sizeCm: number, pagePx: number): string {
  const out = [
    `Página ${sizeCm} cm (${pagePx} px @ ${PRINT_DPI} DPI)`,
    `optimizador de subida ${p.optimize ? "sí" : "no"}`,
    `canvas ${p.colorSpace === "srgb" ? "sRGB" : "Display P3"}`,
    p.format === "png" ? "PNG sin pérdida" : `JPEG ${Math.round(p.quality * 100)} %`,
    `perfil ICC ${p.embedIcc && p.format === "jpeg" && p.colorSpace === "srgb" ? "sRGB" : "ninguno"}`,
    `brillo ${p.brightness.toFixed(2)}`,
    `contraste ${p.contrast.toFixed(2)}`,
    `saturación ${p.saturation.toFixed(2)}`,
  ];
  return out.join(" · ");
}

export function PrintTest({ sizes }: { sizes: Size[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [sizeCm, setSizeCm] = useState<number>(sizes[0]?.cm ?? 20);
  const [params, setParams] = useState<Params>(REAL_PIPELINE);
  const [original, setOriginal] = useState<Original | null>(null);
  const [processed, setProcessed] = useState<Processed | null>(null);
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);
  const runIdRef = useRef(0);
  // Object URLs of the images on screen, kept in refs so the previous ones
  // can be revoked when a new result lands.
  const originalUrlRef = useRef<string | null>(null);
  const processedUrlRef = useRef<string | null>(null);

  async function describeOriginal(f: File): Promise<Original> {
    const url = URL.createObjectURL(f);
    const [img, icc] = await Promise.all([
      loadImage(url),
      f.type === "image/jpeg"
        ? f.arrayBuffer().then((b) => readJpegIccDescription(new Uint8Array(b)))
        : Promise.resolve(null),
    ]);
    return {
      url,
      name: f.name,
      type: f.type || "desconocido",
      bytes: f.size,
      width: img?.naturalWidth ?? null,
      height: img?.naturalHeight ?? null,
      icc,
    };
  }

  // With the default params this mirrors generate-sheets.tsx step by step:
  // same upload optimizer, same page drawing, same canvas color space, same
  // JPEG export. Each knob swaps out exactly one of those steps.
  async function renderAsPrinted(f: File, cm: number, p: Params): Promise<Processed> {
    let source: Blob = f;
    let uploadedType = f.type;
    if (p.optimize) {
      const { full, fullContentType } = await optimizeImage(f);
      source = full;
      uploadedType = fullContentType;
    }
    const passthrough = source === f;

    const sourceUrl = URL.createObjectURL(source);
    try {
      const img = await loadImage(sourceUrl);
      if (!img) throw new Error("El navegador no pudo decodificar el archivo. En Chrome, prueba activar el optimizador de subida o usa Safari para HEIC.");

      const { pagePx } = getSheetLayout(cm);
      const canvas = document.createElement("canvas");
      canvas.width = pagePx;
      canvas.height = pagePx;
      const ctx = canvas.getContext("2d", { colorSpace: p.colorSpace })!;
      ctx.filter = filterFor(p);
      drawBookPage(ctx, img, DEFAULT_CROP, 0, 0, pagePx);
      ctx.filter = "none";

      let blob: Blob;
      if (isRealPipeline(p)) {
        blob = await exportSheetJpeg(canvas);
      } else if (p.format === "png") {
        blob = await canvasToBlob(canvas, "image/png");
      } else {
        blob = await canvasToBlob(canvas, "image/jpeg", p.quality);
        if (p.embedIcc && p.colorSpace === "srgb") blob = await embedSrgbProfile(blob);
      }

      const icc =
        p.format === "jpeg"
          ? readJpegIccDescription(new Uint8Array(await blob.arrayBuffer()))
          : null;
      const base = f.name.replace(/\.[^.]+$/, "");
      return {
        url: URL.createObjectURL(blob),
        name: `impresion_${cm}cm_${base}.${p.format === "png" ? "png" : "jpg"}`,
        bytes: blob.size,
        pagePx,
        passthrough,
        uploadedType,
        icc,
        params: p,
      };
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  async function run(f: File, cm: number, p: Params, withOriginal: boolean) {
    const id = ++runIdRef.current;
    setBusy(true);
    setError(null);
    try {
      const [o, pr] = await Promise.all([
        withOriginal ? describeOriginal(f) : Promise.resolve(null),
        renderAsPrinted(f, cm, p),
      ]);
      if (id !== runIdRef.current) {
        // A newer run superseded this one; drop its result.
        if (o) URL.revokeObjectURL(o.url);
        URL.revokeObjectURL(pr.url);
        return;
      }
      if (o) {
        if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
        originalUrlRef.current = o.url;
        setOriginal(o);
      }
      if (processedUrlRef.current) URL.revokeObjectURL(processedUrlRef.current);
      processedUrlRef.current = pr.url;
      setProcessed(pr);
    } catch (e) {
      if (id === runIdRef.current) {
        setError(e instanceof Error ? e.message : "No se pudo procesar la imagen.");
      }
    } finally {
      if (id === runIdRef.current) setBusy(false);
    }
  }

  /** Sliders fire continuously; wait for the hand to settle before re-rendering. */
  function scheduleRun(f: File, cm: number, p: Params) {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => run(f, cm, p, false), 250);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    run(f, sizeCm, params, true);
  }

  function onSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const cm = Number(e.target.value);
    setSizeCm(cm);
    if (file) run(file, cm, params, false);
  }

  function update(patch: Partial<Params>) {
    const next = { ...params, ...patch };
    setParams(next);
    if (file) scheduleRun(file, sizeCm, next);
  }

  function reset() {
    setParams(REAL_PIPELINE);
    if (file) run(file, sizeCm, REAL_PIPELINE, false);
  }

  // One landscape 13"×19" sheet with both images at the same size, labeled,
  // plus the parameters used so several test prints can be told apart.
  async function downloadComparison() {
    if (!original || !processed || !file) return;
    setComposing(true);
    setError(null);
    try {
      const [origImg, procImg] = await Promise.all([
        loadImage(original.url),
        loadImage(processed.url),
      ]);
      if (!origImg) throw new Error("El navegador no puede dibujar el original (HEIC en Chrome). Usa Safari para la hoja de comparación.");
      if (!procImg) throw new Error("No se pudo cargar la imagen procesada.");

      const W = SHEET_H_PX; // landscape: 19" wide
      const H = SHEET_W_PX; // 13" tall
      const cmPx = PRINT_DPI / 2.54;
      const margin = Math.round(cmPx * 1.5);
      const gutter = Math.round(cmPx * 1.5);
      const labelH = Math.round(cmPx * 1.2);
      const footerH = Math.round(cmPx * 1.2);

      // Fit two pages side by side; large sizes are scaled down to fit.
      const availW = W - margin * 2 - gutter;
      const availH = H - margin * 2 - labelH - footerH;
      const tile = Math.min(Math.floor(availW / 2), availH, processed.pagePx);

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d", { colorSpace: "srgb" })!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      const leftX = Math.round((W - (tile * 2 + gutter)) / 2);
      const rightX = leftX + tile + gutter;
      const topY = margin + labelH;

      ctx.fillStyle = "#000000";
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "center";
      ctx.font = `bold ${Math.round(cmPx * 0.7)}px sans-serif`;
      ctx.fillText("Original", leftX + tile / 2, margin + labelH * 0.7);
      ctx.fillText("Procesada", rightX + tile / 2, margin + labelH * 0.7);

      // Original: contained in its tile, no page margin, drawn straight from
      // the file bytes the browser decoded.
      const aspect = origImg.naturalWidth / origImg.naturalHeight;
      const ow = aspect >= 1 ? tile : tile * aspect;
      const oh = aspect >= 1 ? tile / aspect : tile;
      ctx.drawImage(origImg, leftX + (tile - ow) / 2, topY + (tile - oh) / 2, ow, oh);

      // Processed: the rendered page, which already includes its white margin.
      ctx.drawImage(procImg, rightX, topY, tile, tile);

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.strokeRect(leftX, topY, tile, tile);
      ctx.strokeRect(rightX, topY, tile, tile);

      ctx.font = `${Math.round(cmPx * 0.35)}px sans-serif`;
      ctx.fillStyle = "#333333";
      ctx.fillText(
        `${original.name} · ${original.type} · ${original.icc ?? "sin perfil ICC"}`,
        W / 2,
        topY + tile + footerH * 0.45,
      );
      ctx.fillText(
        describeParams(processed.params, sizeCm, processed.pagePx),
        W / 2,
        topY + tile + footerH * 0.9,
      );

      const raw = await canvasToBlob(canvas, "image/jpeg", SHEET_JPEG_QUALITY);
      const blob = await embedSrgbProfile(raw);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comparacion_${sizeCm}cm_${file.name.replace(/\.[^.]+$/, "")}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la comparación.");
    } finally {
      setComposing(false);
    }
  }

  const realPipeline = isRealPipeline(params);
  const iccApplies = params.format === "jpeg" && params.colorSpace === "srgb";

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Foto</label>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,.heic,.heif"
              onChange={onFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="w-full justify-start sm:w-auto"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {file ? file.name : "Elegir foto"}
            </Button>
          </div>
          <div className="w-full space-y-2 sm:w-56">
            <label className="text-sm font-medium">Tamaño de página</label>
            <Select value={sizeCm} onChange={onSizeChange} disabled={busy}>
              {sizes.map((s) => (
                <option key={s.cm} value={s.cm}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Parámetros de procesado</CardTitle>
            <CardDescription>
              {realPipeline
                ? "Valores idénticos al generador de hojas."
                : "Valores distintos al generador de hojas. La imagen de la derecha se regenera con cada cambio."}
            </CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={realPipeline}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Pipeline real
          </Button>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <Toggle
              label="Optimizador de subida"
              hint="JPEG/PNG/WebP pasan sin cambios; HEIC se re-codifica a JPEG 95 %. Apagado: la foto se dibuja directo del archivo."
              checked={params.optimize}
              onChange={(v) => update({ optimize: v })}
            />
            <Toggle
              label="Convertir a sRGB"
              hint="Apagado: el canvas se queda en Display P3 y el archivo sale sin perfil, como en la primera versión."
              checked={params.colorSpace === "srgb"}
              onChange={(v) => update({ colorSpace: v ? "srgb" : "display-p3" })}
            />
            <Toggle
              label="Incrustar perfil sRGB"
              hint={iccApplies ? "Etiqueta el JPEG para que la imprenta no adivine el espacio de color." : "Solo aplica con JPEG en sRGB."}
              checked={params.embedIcc && iccApplies}
              disabled={!iccApplies}
              onChange={(v) => update({ embedIcc: v })}
            />
            <Toggle
              label="Compresión JPEG"
              hint="Apagado: se exporta PNG sin pérdida (archivo mucho más pesado, sin perfil)."
              checked={params.format === "jpeg"}
              onChange={(v) => update({ format: v ? "jpeg" : "png" })}
            />
            <Slider
              label="Calidad JPEG"
              value={params.quality}
              min={0.5}
              max={1}
              step={0.01}
              display={`${Math.round(params.quality * 100)} %`}
              disabled={params.format !== "jpeg"}
              onChange={(v) => update({ quality: v })}
            />
          </div>
          <div className="space-y-4">
            <Slider
              label="Brillo"
              value={params.brightness}
              min={0.7}
              max={1.5}
              step={0.01}
              display={`${Math.round((params.brightness - 1) * 100) >= 0 ? "+" : ""}${Math.round((params.brightness - 1) * 100)} %`}
              onChange={(v) => update({ brightness: v })}
            />
            <Slider
              label="Contraste"
              value={params.contrast}
              min={0.7}
              max={1.5}
              step={0.01}
              display={`${Math.round((params.contrast - 1) * 100) >= 0 ? "+" : ""}${Math.round((params.contrast - 1) * 100)} %`}
              onChange={(v) => update({ contrast: v })}
            />
            <Slider
              label="Saturación"
              value={params.saturation}
              min={0.5}
              max={1.5}
              step={0.01}
              display={`${Math.round((params.saturation - 1) * 100) >= 0 ? "+" : ""}${Math.round((params.saturation - 1) * 100)} %`}
              onChange={(v) => update({ saturation: v })}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {original && processed && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Original</CardTitle>
                <CardDescription>
                  El archivo tal cual lo subiste, sin compresión ni conversión. El
                  navegador aplica el perfil de color de la foto para mostrarla.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Preview url={original.url} alt="Original" />
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Formato</dt>
                  <dd>{original.type}</dd>
                  <dt className="text-muted-foreground">Peso</dt>
                  <dd>{formatBytes(original.bytes)}</dd>
                  <dt className="text-muted-foreground">Dimensiones</dt>
                  <dd>
                    {original.width && original.height
                      ? `${original.width} × ${original.height} px`
                      : "el navegador no pudo mostrarla"}
                  </dd>
                  <dt className="text-muted-foreground">Perfil ICC</dt>
                  <dd>
                    {original.type === "image/jpeg"
                      ? original.icc ?? "sin perfil (se asume sRGB)"
                      : "solo se detecta en JPEG"}
                  </dd>
                </dl>
                <DownloadLink url={original.url} name={original.name} label="Descargar original" />
              </CardContent>
            </Card>

            <Card className={busy ? "opacity-60 transition-opacity" : "transition-opacity"}>
              <CardHeader>
                <CardTitle>Procesada</CardTitle>
                <CardDescription>
                  Una página del fotolibro con encuadre por defecto, generada con
                  los parámetros de arriba.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Preview url={processed.url} alt="Procesada" />
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  <li>
                    Subida:{" "}
                    {!processed.params.optimize
                      ? "optimizador apagado, se usa el archivo tal cual"
                      : processed.passthrough
                        ? "el archivo se guarda sin cambios"
                        : `re-codificado a ${processed.uploadedType} (formato no compatible con el editor)`}
                  </li>
                  <li>
                    Dibujado en canvas {processed.params.colorSpace === "srgb" ? "sRGB" : "Display P3"} a{" "}
                    {PRINT_DPI} DPI: página de {sizeCm} cm = {processed.pagePx} × {processed.pagePx} px, margen 10 %
                    {filterFor(processed.params) !== "none" && ` · filtro ${filterFor(processed.params)}`}
                  </li>
                  <li>
                    {processed.params.format === "png"
                      ? "Exportado como PNG sin pérdida"
                      : `Exportado como JPEG al ${Math.round(processed.params.quality * 100)} %`}
                  </li>
                  <li>
                    Perfil ICC incrustado:{" "}
                    {processed.icc ?? <span className="text-destructive">ninguno</span>}
                  </li>
                </ol>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Peso</dt>
                  <dd>{formatBytes(processed.bytes)}</dd>
                </dl>
                <DownloadLink url={processed.url} name={processed.name} label="Descargar procesada" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Hoja de comparación</p>
                <p className="text-sm text-muted-foreground">
                  Una hoja de 19&quot; × 13&quot; con las dos imágenes lado a lado,
                  etiquetadas y con los parámetros usados al pie. Sale en sRGB con
                  perfil incrustado; el lado original se dibuja del archivo sin
                  compresión previa.
                </p>
              </div>
              <Button type="button" onClick={downloadComparison} disabled={busy || composing}>
                {composing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Descargar comparación
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <Checkbox
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className={`block space-y-1 ${disabled ? "opacity-50" : ""}`}>
      <span className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </label>
  );
}

function Preview({ url, alt }: { url: string; alt: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className="aspect-square w-full rounded-md border border-border bg-white object-contain"
      />
    </a>
  );
}

function DownloadLink({ url, name, label }: { url: string; name: string; label: string }) {
  return (
    <a
      href={url}
      download={name}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <Download className="h-4 w-4" />
      {label}
    </a>
  );
}
