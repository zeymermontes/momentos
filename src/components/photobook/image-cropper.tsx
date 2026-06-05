"use client";

import {
  useRef,
  useState,
  useEffect,
  type PointerEvent as RPointerEvent,
} from "react";
import { RotateCw } from "lucide-react";
import type { CropState } from "@/lib/photobook-config";

type Props = {
  src: string;
  imgWidth: number;
  imgHeight: number;
  crop: CropState;
  onChange: (crop: CropState) => void;
  titleOverlay?: string;
  /**
   * Physical page size in cm. When provided, the cropper enforces a max
   * zoom that keeps the printed crop at or above DPI_FLOOR (PPI shown in
   * the live badge), and the badge is rendered in the corner.
   */
  pageSizeCm?: number;
};

const PAN_DAMPING = 0.45;
const ZOOM_FACTOR = 1.04;
const MIN_SCALE = 0.01;

// Print quality thresholds. The Xerox C70 prints best at ~600 PPI source;
// 300 PPI is the industry standard floor for photo quality. Below 200
// PPI prints look visibly soft.
const PPI_EXCELLENT = 600;
const PPI_GOOD = 300;
const DPI_FLOOR = 200; // we don't let the user zoom past this

const REF = 400;
const REF_CONTENT = REF * 0.8;
const REF_MARGIN = REF * 0.1;

export function ImageCropper({
  src,
  imgWidth,
  imgHeight,
  crop,
  onChange,
  titleOverlay,
  pageSizeCm,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  // Active pointers indexed by pointerId so we can detect single-finger
  // pan vs. two-finger pinch on touch devices.
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  // Snapshot taken when the second finger lands; pinch deltas are computed
  // against this baseline so a slow gesture doesn't drift.
  const pinchStart = useRef<null | {
    dist: number;
    mid: { x: number; y: number };
    scale: number;
    cropX: number;
    cropY: number;
  }>(null);
  const [displaySize, setDisplaySize] = useState(REF);

  const live = useRef(crop);
  live.current = crop;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Quality math: base PPI assumes the source image is "contain"-fit into
  // the print content area (sizeCm × 0.8). Effective PPI scales inversely
  // with crop.scale because zooming uses fewer source pixels per inch of
  // print. maxScale clamps zoom so the print stays at >= DPI_FLOOR.
  const longSide = Math.max(imgWidth, imgHeight);
  const contentInches = pageSizeCm
    ? (pageSizeCm * 0.8) / 2.54
    : null;
  const basePpi = contentInches ? longSide / contentInches : null;
  const maxScale =
    basePpi && basePpi > 0 ? Math.max(MIN_SCALE, basePpi / DPI_FLOOR) : null;
  const currentPpi = basePpi ? basePpi / Math.max(crop.scale, MIN_SCALE) : null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setDisplaySize(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scaleRatio = displaySize / REF;

  const aspect = imgWidth / imgHeight;
  const isLandscape = aspect >= 1;
  const containW = isLandscape ? REF_CONTENT : REF_CONTENT * aspect;
  const containH = isLandscape ? REF_CONTENT / aspect : REF_CONTENT;

  const rotation = crop.rotation ?? 0;

  // --- Pointer (pan + pinch zoom) ---
  // Mouse deltas are in display-space pixels; convert to REF-space.
  const onPointerDown = (e: RPointerEvent) => {
    // Mouse: only the left button initiates drag. Touch/pen: always.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (pointers.current.size === 1) {
      dragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      pinchStart.current = null;
    } else if (pointers.current.size === 2) {
      // Switch from pan to pinch. Snapshot starting distance + midpoint
      // so we can compute a stable zoom factor against the baseline.
      dragging.current = false;
      const [p1, p2] = Array.from(pointers.current.values());
      pinchStart.current = {
        dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
        scale: live.current.scale,
        cropX: live.current.x,
        cropY: live.current.y,
      };
    }
  };

  const onPointerMove = (e: RPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-finger pinch zoom toward the gesture's midpoint.
    if (pointers.current.size >= 2 && pinchStart.current) {
      const pts = Array.from(pointers.current.values()).slice(0, 2);
      const [p1, p2] = pts;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (dist === 0) return;
      const start = pinchStart.current;
      const proposed = start.scale * (dist / start.dist);
      const newScale = maxScale
        ? Math.min(maxScale, Math.max(MIN_SCALE, proposed))
        : Math.max(MIN_SCALE, proposed);
      const ratio = newScale / start.scale;

      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const sr = scaleRef.current;
      // Midpoint mapped from display-space to REF-space content coords.
      const mx = (start.mid.x - rect.left) / sr - REF_MARGIN;
      const my = (start.mid.y - rect.top) / sr - REF_MARGIN;
      const newX = (1 - ratio) * (mx - REF_CONTENT / 2) + ratio * start.cropX;
      const newY = (1 - ratio) * (my - REF_CONTENT / 2) + ratio * start.cropY;

      const next: CropState = {
        ...live.current,
        scale: newScale,
        x: newX,
        y: newY,
      };
      live.current = next;
      onChange(next);
      return;
    }

    // Single-finger / mouse pan.
    if (!dragging.current) return;
    const rawDx = (e.clientX - lastPos.current.x) * PAN_DAMPING;
    const rawDy = (e.clientY - lastPos.current.y) * PAN_DAMPING;
    lastPos.current = { x: e.clientX, y: e.clientY };
    const dx = rawDx / scaleRatio;
    const dy = rawDy / scaleRatio;
    const c = live.current;
    const next: CropState = { ...c, x: c.x + dx, y: c.y + dy };
    live.current = next;
    onChange(next);
  };

  const onPointerUp = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) {
      pinchStart.current = null;
    }
    if (pointers.current.size === 0) {
      dragging.current = false;
    } else if (pointers.current.size === 1) {
      // Pinch ended mid-gesture but one finger is still down. Resume pan
      // from the remaining pointer's position so no jump happens.
      const [remaining] = Array.from(pointers.current.values());
      lastPos.current = { x: remaining.x, y: remaining.y };
      dragging.current = true;
    }
  };

  // --- Wheel (zoom toward cursor) ---
  const scaleRef = useRef(scaleRatio);
  scaleRef.current = scaleRatio;
  // Keep the latest maxScale accessible from the wheel handler (which
  // is bound inside an empty-deps useEffect to avoid re-listening on
  // every render).
  const maxScaleRef = useRef(maxScale);
  maxScaleRef.current = maxScale;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      e.stopPropagation();

      const c = live.current;
      const sr = scaleRef.current;
      const factor = e.deltaY > 0 ? (1 / ZOOM_FACTOR) : ZOOM_FACTOR;
      const cap = maxScaleRef.current;
      const proposed = c.scale * factor;
      const newScale = cap
        ? Math.min(cap, Math.max(MIN_SCALE, proposed))
        : Math.max(MIN_SCALE, proposed);

      const ratio = newScale / c.scale;
      const rect = el!.getBoundingClientRect();
      // Convert display-space mouse position to REF-space content-area coordinates
      const mx = (e.clientX - rect.left) / sr - REF_MARGIN;
      const my = (e.clientY - rect.top) / sr - REF_MARGIN;

      const newX = (1 - ratio) * (mx - REF_CONTENT / 2) + ratio * c.x;
      const newY = (1 - ratio) * (my - REF_CONTENT / 2) + ratio * c.y;

      const next: CropState = { ...c, scale: newScale, x: newX, y: newY };
      live.current = next;
      onChangeRef.current(next);
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  function handleRotate() {
    const c = live.current;
    const next: CropState = { ...c, rotation: ((c.rotation ?? 0) + 90) % 360 };
    live.current = next;
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative aspect-square w-full select-none overflow-hidden bg-white shadow-inner"
      >
        {/* Scaled visual layer — renders at REF size, CSS-scaled to fit */}
        <div
          style={{
            width: REF,
            height: REF,
            transform: `scale(${scaleRatio})`,
            transformOrigin: "top left",
            position: "absolute",
            pointerEvents: "none",
          }}
        >
          {/* Margin overlay */}
          <div
            className="absolute"
            style={{
              inset: 0,
              borderWidth: REF_MARGIN,
              borderColor: "rgba(255,255,255,0.85)",
              borderStyle: "solid",
              zIndex: 10,
            }}
          />

          {/* Content area */}
          <div
            className="absolute"
            style={{
              top: REF_MARGIN,
              left: REF_MARGIN,
              width: REF_CONTENT,
              height: REF_CONTENT,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{
                width: containW,
                height: "auto",
                aspectRatio: `${imgWidth} / ${imgHeight}`,
                left: (REF_CONTENT - containW) / 2,
                top: (REF_CONTENT - containH) / 2,
                transformOrigin: "center center",
                transform: `translate(${crop.x}px, ${crop.y}px) scale(${crop.scale}) rotate(${rotation}deg)`,
              }}
            />
          </div>

          {/* Margin lines */}
          <div
            className="absolute border border-dashed border-gray-300"
            style={{
              top: REF_MARGIN,
              left: REF_MARGIN,
              width: REF_CONTENT,
              height: REF_CONTENT,
              zIndex: 20,
            }}
          />

          {/* Title in bottom margin (cover only) */}
          {titleOverlay && (
            <div
              className="absolute left-0 right-0 flex items-center justify-center"
              style={{ bottom: 0, height: REF_MARGIN, zIndex: 20 }}
            >
              <span className="text-sm font-semibold text-gray-700 truncate px-4">
                {titleOverlay}
              </span>
            </div>
          )}
        </div>

        {/* Invisible interaction layer at actual display size. `touch-action:
            none` is what stops the browser from scrolling the page or
            pinch-zooming the viewport while the user manipulates the image
            inside the cropper. */}
        <div
          className="absolute inset-0 z-30"
          style={{ cursor: "grab", touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {/* Live DPI badge — only when the caller passed pageSizeCm so we
            can compute meaningful values. */}
        {currentPpi != null ? <DpiBadge ppi={currentPpi} /> : null}
      </div>

      {/* Toolbar */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleRotate}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Rotar 90°
        </button>
      </div>
    </div>
  );
}

/**
 * Live quality readout — color-codes the effective print PPI so the
 * user can tell whether their current crop is going to print sharp or
 * soft before they commit.
 */
function DpiBadge({ ppi }: { ppi: number }) {
  const tier =
    ppi >= PPI_EXCELLENT
      ? {
          label: "Calidad máxima",
          bg: "bg-emerald-600",
          text: "text-white",
        }
      : ppi >= PPI_GOOD
        ? {
            label: "Buena calidad",
            bg: "bg-emerald-500",
            text: "text-white",
          }
        : ppi >= DPI_FLOOR
          ? {
              label: "Calidad reducida",
              bg: "bg-amber-500",
              text: "text-white",
            }
          : {
              label: "Va a salir borroso",
              bg: "bg-red-500",
              text: "text-white",
            };
  return (
    <div
      className={`pointer-events-none absolute right-3 top-3 z-40 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${tier.bg} ${tier.text}`}
      title={`Resolución efectiva al imprimir: ${Math.round(ppi)} PPI`}
    >
      {Math.round(ppi)} PPI · {tier.label}
    </div>
  );
}
