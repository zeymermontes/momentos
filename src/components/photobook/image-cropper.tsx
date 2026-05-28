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
};

const PAN_DAMPING = 0.45;
const ZOOM_FACTOR = 1.04;
const MIN_SCALE = 0.01;

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
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [displaySize, setDisplaySize] = useState(REF);

  const live = useRef(crop);
  live.current = crop;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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

  // --- Pointer (pan) ---
  // Mouse deltas are in display-space pixels; convert to REF-space.
  const onPointerDown = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: RPointerEvent) => {
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

  const onPointerUp = () => {
    dragging.current = false;
  };

  // --- Wheel (zoom toward cursor) ---
  const scaleRef = useRef(scaleRatio);
  scaleRef.current = scaleRatio;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      e.stopPropagation();

      const c = live.current;
      const sr = scaleRef.current;
      const factor = e.deltaY > 0 ? (1 / ZOOM_FACTOR) : ZOOM_FACTOR;
      const newScale = Math.max(MIN_SCALE, c.scale * factor);

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

        {/* Invisible interaction layer at actual display size */}
        <div
          className="absolute inset-0 z-30"
          style={{ cursor: "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
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
