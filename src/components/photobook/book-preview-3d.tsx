"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageThumb } from "@/components/photobook/page-preview";
import type { PhotobookProject, PhotobookPage } from "@/lib/photobook-config";
import type { CropState } from "@/lib/photobook-config";

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

  const canNext = flippedCount < totalLeaves;
  const canPrev = flippedCount > 0;

  function goNext() {
    if (canNext) setFlippedCount((c) => c + 1);
  }
  function goPrev() {
    if (canPrev) setFlippedCount((c) => c - 1);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Book */}
      <div
        className="relative"
        style={{
          width: 320,
          height: 320,
          perspective: 1800,
          filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.18)) drop-shadow(0 2px 6px rgba(0,0,0,0.1))",
        }}
      >
        {/* Book base (back cover always visible) */}
        <div className="absolute inset-0 bg-gray-200" />

        {/* Leaves */}
        {leaves.map((leaf, i) => {
          const isFlipped = i < flippedCount;
          const zIndex = isFlipped
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
  const src = page.image_url ?? page.thumb_url!;
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
