"use client";

import { useRef, useState, useEffect } from "react";
import type { CropState } from "@/lib/photobook-config";

/**
 * All crop coordinates (x, y) are pixel values relative to the editor's
 * content area. The editor's container defaults to REF (400px), making the
 * content area REF_CONTENT (320px). To display crops correctly at ANY size
 * we render at the fixed reference dimensions and CSS-scale the result.
 */
const REF = 400;
const REF_CONTENT = REF * 0.8;
const REF_MARGIN = REF * 0.1;

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function containDims(imgW: number, imgH: number) {
  const aspect = imgW / imgH;
  return {
    w: aspect >= 1 ? REF_CONTENT : REF_CONTENT * aspect,
    h: aspect >= 1 ? REF_CONTENT / aspect : REF_CONTENT,
  };
}

// ---------- Full-size preview (editor right panel) ----------

type PreviewProps = {
  imageUrl: string;
  imgDims: { width: number; height: number } | null;
  crop: CropState;
  pageNum?: number;
};

export function PagePreview({ imageUrl, imgDims, crop, pageNum }: PreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const boxSize = useContainerWidth(ref);
  const scaleDown = boxSize > 0 ? boxSize / REF : 0;

  const cd = imgDims ? containDims(imgDims.width, imgDims.height) : null;

  return (
    <div
      ref={ref}
      className="relative aspect-square w-full overflow-hidden bg-white shadow-lg"
    >
      {scaleDown > 0 && (
        <div
          style={{
            width: REF,
            height: REF,
            transform: `scale(${scaleDown})`,
            transformOrigin: "top left",
            position: "relative",
          }}
        >
          {imageUrl && cd ? (
            <div
              className="absolute overflow-hidden"
              style={{ top: REF_MARGIN, left: REF_MARGIN, width: REF_CONTENT, height: REF_CONTENT }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                className="absolute select-none"
                style={{
                  width: cd.w,
                  height: "auto",
                  aspectRatio: `${imgDims!.width} / ${imgDims!.height}`,
                  left: (REF_CONTENT - cd.w) / 2,
                  top: (REF_CONTENT - cd.h) / 2,
                  transformOrigin: "center center",
                  transform: `translate(${crop.x}px, ${crop.y}px) scale(${crop.scale}) rotate(${crop.rotation ?? 0}deg)`,
                }}
              />
            </div>
          ) : (
            <div
              className="absolute grid place-items-center bg-muted/20 text-muted-foreground text-sm"
              style={{ top: REF_MARGIN, left: REF_MARGIN, width: REF_CONTENT, height: REF_CONTENT }}
            >
              Sin foto
            </div>
          )}
          {pageNum != null && (
            <span className="absolute text-[10px] text-gray-400" style={{ bottom: 8, right: 12 }}>
              {pageNum}
            </span>
          )}
        </div>
      )}
      <div className="absolute inset-0 ring-1 ring-border" />
    </div>
  );
}

// ---------- Grid thumbnail ----------

export function PageThumb({
  src,
  crop,
}: {
  src: string;
  crop: CropState;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const thumbSize = useContainerWidth(ref);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const scaleDown = thumbSize > 0 ? thumbSize / REF : 0;
  const cd = dims ? containDims(dims.w, dims.h) : { w: REF_CONTENT, h: REF_CONTENT };

  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden">
      {scaleDown > 0 && (
        <div
          style={{
            width: REF,
            height: REF,
            transform: `scale(${scaleDown})`,
            transformOrigin: "top left",
            position: "relative",
          }}
        >
          <div
            className="absolute overflow-hidden"
            style={{ top: REF_MARGIN, left: REF_MARGIN, width: REF_CONTENT, height: REF_CONTENT }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute select-none"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > 0) {
                  setDims({ w: img.naturalWidth, h: img.naturalHeight });
                }
              }}
              style={{
                width: cd.w,
                height: "auto",
                ...(dims ? { aspectRatio: `${dims.w} / ${dims.h}` } : {}),
                left: (REF_CONTENT - cd.w) / 2,
                top: (REF_CONTENT - cd.h) / 2,
                transformOrigin: "center center",
                transform: `translate(${crop.x}px, ${crop.y}px) scale(${crop.scale}) rotate(${crop.rotation ?? 0}deg)`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
