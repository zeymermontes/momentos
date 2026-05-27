"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type PointerEvent as RPointerEvent,
  type WheelEvent as RWheelEvent,
} from "react";
import type { CropState } from "@/lib/photobook";

type Props = {
  src: string;
  imgWidth: number;
  imgHeight: number;
  crop: CropState;
  onChange: (crop: CropState) => void;
  containerSize?: number;
};

export function ImageCropper({
  src,
  imgWidth,
  imgHeight,
  crop,
  onChange,
  containerSize = 400,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [size, setSize] = useState(containerSize);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const contentSize = size * 0.8;

  const aspect = imgWidth / imgHeight;
  const containW = aspect >= 1 ? contentSize : contentSize * aspect;
  const containH = aspect >= 1 ? contentSize / aspect : contentSize;

  const displayW = containW * crop.scale;
  const displayH = containH * crop.scale;

  const clamp = useCallback(
    (x: number, y: number, s: number) => {
      const dW = (aspect >= 1 ? contentSize : contentSize * aspect) * s;
      const dH = (aspect >= 1 ? contentSize / aspect : contentSize) * s;
      const maxX = Math.max(0, (dW - contentSize) / 2);
      const maxY = Math.max(0, (dH - contentSize) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [aspect, contentSize],
  );

  const onPointerDown = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: RPointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    const clamped = clamp(crop.x + dx, crop.y + dy, crop.scale);
    onChange({ ...crop, ...clamped });
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  const onWheel = (e: RWheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    const newScale = Math.min(4, Math.max(1, crop.scale * delta));
    const clamped = clamp(crop.x, crop.y, newScale);
    onChange({ ...crop, scale: newScale, ...clamped });
  };

  const margin = size * 0.1;

  return (
    <div
      ref={containerRef}
      className="relative aspect-square w-full select-none overflow-hidden rounded-lg bg-white shadow-inner"
      style={{ maxWidth: containerSize }}
    >
      {/* Margin overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          borderWidth: margin,
          borderColor: "rgba(255,255,255,0.85)",
          borderStyle: "solid",
        }}
      />

      {/* Content area */}
      <div
        className="absolute overflow-hidden"
        style={{
          top: margin,
          left: margin,
          width: contentSize,
          height: contentSize,
          cursor: crop.scale > 1 ? "grab" : "default",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          className="absolute select-none"
          style={{
            width: displayW,
            height: displayH,
            left: (contentSize - displayW) / 2 + crop.x,
            top: (contentSize - displayH) / 2 + crop.y,
          }}
        />
      </div>

      {/* Margin lines */}
      <div
        className="absolute pointer-events-none z-20 border border-dashed border-gray-300"
        style={{
          top: margin,
          left: margin,
          width: contentSize,
          height: contentSize,
        }}
      />
    </div>
  );
}
