"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageThumb } from "@/components/photobook/page-preview";
import type { PhotobookProject, PhotobookPage } from "@/lib/photobook-config";
import type { CropState } from "@/lib/photobook-config";

// Reference book dimensions. The book itself is REF_BOOK × REF_BOOK; the
// "spread" reserves a second REF_BOOK to the left so a flipped page (which
// rotates -180° around the spine) has room to land instead of clipping
// off-screen on mobile. The whole thing is CSS-scaled to fit narrower
// viewports without touching the internal layout.
const REF_BOOK = 320;
const REF_SPREAD = REF_BOOK * 2;
// Reserved horizontal room (per side) for the drop-shadow on the book and
// the box-shadows on the leaves to render without bleeding past the
// wrapper. The open spread visually caps at parentWidth - 40 px on
// mobile so the shadows have room; on desktop the scale clamps at 1
// and we use the original 320×320 book regardless.
const SHADOW_PAD = 20;

type Props = {
  project: PhotobookProject;
  coverUrl: string | null;
  pages: PhotobookPage[];
};

export function BookPreview3D({ project, coverUrl, pages }: Props) {
  const filledPages = pages.filter((p) => p.image_url);
  const leaves: { front: React.ReactNode; back: React.ReactNode }[] = [];

  // Leaf 0: cover front + blank inside cover
  leaves.push({
    front: <CoverFace coverUrl={coverUrl} coverCrop={project.cover_crop} title={project.title} />,
    back: <BlankFace />,
  });

  // Content leaves: 2 pages per leaf
  for (let i = 0; i < filledPages.length; i += 2) {
    leaves.push({
      front: (
        <PageFace page={filledPages[i]} pageNum={i + 1} />
      ),
      back:
        i + 1 < filledPages.length ? (
          <PageFace page={filledPages[i + 1]} pageNum={i + 2} />
        ) : (
          <BlankFace />
        ),
    });
  }

  // Back cover leaf
  leaves.push({
    front: <BlankFace />,
    back: <BackCoverFace />,
  });

  const totalLeaves = leaves.length;
  const [flippedCount, setFlippedCount] = useState(0);
  // Index of the leaf currently mid-animation. While a leaf is rotating
  // we override its zIndex so it stays on top regardless of the new
  // flipped/unflipped value — otherwise the leaf below it pops into
  // view at click time, before the rotation completes (most visible
  // when flipping back).
  const [animatingLeaf, setAnimatingLeaf] = useState<number | null>(null);

  const canNext = flippedCount < totalLeaves;
  const canPrev = flippedCount > 0;

  // Measure the available width and shrink the book proportionally so a
  // full open spread (2 × REF_BOOK) always fits the parent.
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      // Subtract twice SHADOW_PAD so the visual shadows on each side fit
      // inside the wrapper. Clamp to 0 to avoid a negative scale on very
      // narrow containers.
      const usable = Math.max(0, w - SHADOW_PAD * 2);
      setScale(Math.min(1, usable / REF_SPREAD));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function goNext() {
    if (!canNext) return;
    // The leaf that's about to flip forward.
    setAnimatingLeaf(flippedCount);
    setFlippedCount((c) => c + 1);
  }
  function goPrev() {
    if (!canPrev) return;
    // The leaf that's about to flip back.
    setAnimatingLeaf(flippedCount - 1);
    setFlippedCount((c) => c - 1);
  }

  return (
    // `w-full` is required: without it, the flex column shrinks to fit
    // its widest child, which is the scaled spread. ResizeObserver then
    // measures THAT shrunken width and computes a smaller scale, causing
    // a feedback loop that converges to a tiny book on every device.
    <div className="flex w-full flex-col items-center gap-6">
      {/* Responsive wrapper: measure parent width, CSS-scale the spread */}
      <div ref={containerRef} className="w-full">
        <div
          className="relative mx-auto"
          style={{
            width: REF_SPREAD * scale,
            height: REF_BOOK * scale,
          }}
        >
          {/* Logical-size spread, scaled to fit. transformOrigin top-left
              so it pins to the parent's top-left corner before mx-auto
              centers it via the wrapper's computed width above. */}
          <div
            className="absolute left-0 top-0"
            style={{
              width: REF_SPREAD,
              height: REF_BOOK,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {/* Book sits in the right half of the spread so a leaf flipping
                -180° around its left edge lands inside the spread, not
                outside the wrapper. */}
            <div
              className="absolute right-0 top-0"
              style={{
                width: REF_BOOK,
                height: REF_BOOK,
                perspective: 1800,
                filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.18)) drop-shadow(0 2px 6px rgba(0,0,0,0.1))",
              }}
            >
        {/* Book base (back cover always visible) */}
        <div className="absolute inset-0 bg-gray-200" />

        {/* Leaves */}
        {leaves.map((leaf, i) => {
          const isFlipped = i < flippedCount;
          // While this leaf is animating, keep it above everything else
          // so the leaf underneath doesn't flash into view at t=0.
          const isAnimating = animatingLeaf === i;
          const zIndex = isAnimating
            ? leaves.length * 2 + 10
            : isFlipped
              ? leaves.length + i
              : leaves.length - i;

          return (
            <div
              key={i}
              className="absolute inset-0"
              style={{
                transformStyle: "preserve-3d",
                transformOrigin: "left center",
                transform: `rotateY(${isFlipped ? -180 : 0}deg)`,
                transition: "transform 0.8s cubic-bezier(0.645, 0.045, 0.355, 1)",
                zIndex,
              }}
              onTransitionEnd={(e) => {
                // Only react to our own rotateY transition, not any inner
                // box-shadow / filter transitions bubbling up.
                if (e.propertyName !== "transform") return;
                if (animatingLeaf === i) setAnimatingLeaf(null);
              }}
            >
              {/* Front face */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  boxShadow: "4px 2px 12px rgba(0,0,0,0.15), 1px 0 3px rgba(0,0,0,0.08)",
                }}
              >
                {leaf.front}
              </div>

              {/* Back face */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  boxShadow: "-4px 2px 12px rgba(0,0,0,0.15), -1px 0 3px rgba(0,0,0,0.08)",
                }}
              >
                {leaf.back}
              </div>
            </div>
          );
        })}

        {/* Spine shadow */}
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-black/20 to-transparent z-50 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={goPrev}
          disabled={!canPrev}
          className={cn(
            "grid h-10 w-10 place-items-center rounded-full transition",
            canPrev
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <span className="text-sm text-muted-foreground min-w-[120px] text-center">
          {flippedCount === 0
            ? "Portada"
            : flippedCount >= totalLeaves
              ? "Contraportada"
              : flippedCount === 1
                ? `Página 1 de ${filledPages.length}`
                : `Páginas ${(flippedCount - 1) * 2}–${Math.min((flippedCount - 1) * 2 + 1, filledPages.length)} de ${filledPages.length}`}
        </span>

        <button
          onClick={goNext}
          disabled={!canNext}
          className={cn(
            "grid h-10 w-10 place-items-center rounded-full transition",
            canNext
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        {filledPages.length} páginas con foto · {project.size_cm}×{project.size_cm} cm
      </p>
    </div>
  );
}

function CoverFace({
  coverUrl,
  coverCrop,
  title,
}: {
  coverUrl: string | null;
  coverCrop: CropState;
  title: string;
}) {
  return (
    <div className="relative h-full w-full bg-white">
      {coverUrl ? (
        <PageThumb src={coverUrl} crop={coverCrop} />
      ) : (
        <div className="absolute inset-[10%] grid place-items-center bg-primary/10 text-primary">
          <span className="text-lg font-bold">Momentos</span>
        </div>
      )}
      {title && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center" style={{ height: "10%" }}>
          <span className="text-xs font-semibold text-gray-700 truncate px-3">
            {title}
          </span>
        </div>
      )}
    </div>
  );
}

function PageFace({ page, pageNum }: { page: PhotobookPage; pageNum: number }) {
  // Prefer the thumbnail: it's the same image the user already saw on
  // the /paginas step, so the browser cache delivers it instantly. The
  // 3D book face is small enough that a thumb-quality image is more
  // than adequate.
  const src = page.thumb_url ?? page.image_url!;
  return (
    <div className="relative h-full w-full bg-white">
      <PageThumb src={src} crop={page.crop} />
      <span className="absolute bottom-2 right-3 text-[9px] text-gray-400">
        {pageNum}
      </span>
    </div>
  );
}

function BlankFace() {
  return <div className="h-full w-full bg-white" />;
}

function BackCoverFace() {
  return (
    <div className="h-full w-full bg-gray-100 grid place-items-center">
      <span className="text-xs text-gray-400">Momentos</span>
    </div>
  );
}
