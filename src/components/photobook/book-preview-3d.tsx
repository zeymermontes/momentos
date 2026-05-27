"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PhotobookProject, PhotobookPage } from "@/lib/photobook";

type Props = {
  project: PhotobookProject;
  coverUrl: string | null;
  pages: PhotobookPage[];
};

export function BookPreview3D({ project, coverUrl, pages }: Props) {
  const filledPages = pages.filter((p) => p.image_url);
  const totalLeaves = Math.ceil((filledPages.length + 1) / 2);
  const [flippedCount, setFlippedCount] = useState(0);

  const canNext = flippedCount < totalLeaves;
  const canPrev = flippedCount > 0;

  function goNext() {
    if (canNext) setFlippedCount((c) => c + 1);
  }
  function goPrev() {
    if (canPrev) setFlippedCount((c) => c - 1);
  }

  const leaves: { front: React.ReactNode; back: React.ReactNode }[] = [];

  // Leaf 0: cover (front) + page 1 (back)
  leaves.push({
    front: (
      <CoverFace
        coverUrl={coverUrl}
        title={project.title}
      />
    ),
    back: filledPages[0] ? (
      <PageFace src={filledPages[0].image_url!} pageNum={1} />
    ) : (
      <BlankFace />
    ),
  });

  // Remaining leaves: 2 pages per leaf
  for (let i = 1; i < filledPages.length; i += 2) {
    leaves.push({
      front: (
        <PageFace src={filledPages[i].image_url!} pageNum={i + 1} />
      ),
      back:
        i + 1 < filledPages.length ? (
          <PageFace src={filledPages[i + 1].image_url!} pageNum={i + 2} />
        ) : (
          <BackCoverFace />
        ),
    });
  }

  // Ensure last leaf has back cover
  if (filledPages.length % 2 === 0) {
    leaves.push({
      front: <BlankFace />,
      back: <BackCoverFace />,
    });
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
        }}
      >
        {/* Book base (back cover always visible) */}
        <div className="absolute inset-0 rounded-r-lg bg-gray-200 shadow-inner" />

        {/* Leaves — render in reverse so the first leaf is on top */}
        {leaves.map((leaf, i) => {
          const isFlipped = i < flippedCount;
          const zIndex = isFlipped ? i : leaves.length - i;

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
                className="absolute inset-0 overflow-hidden rounded-r-lg"
                style={{ backfaceVisibility: "hidden" }}
              >
                {leaf.front}
              </div>

              {/* Back face */}
              <div
                className="absolute inset-0 overflow-hidden rounded-l-lg"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                {leaf.back}
              </div>
            </div>
          );
        })}

        {/* Spine shadow */}
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-black/20 to-transparent z-50 pointer-events-none rounded-l" />
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

        <span className="text-sm text-muted-foreground min-w-[100px] text-center">
          {flippedCount === 0
            ? "Portada"
            : flippedCount >= totalLeaves
              ? "Contraportada"
              : `Página ${Math.min(flippedCount * 2, filledPages.length)} de ${filledPages.length}`}
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

function CoverFace({ coverUrl, title }: { coverUrl: string | null; title: string }) {
  return (
    <div className="relative h-full w-full bg-white shadow-md">
      <div className="absolute inset-[10%] overflow-hidden">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="Portada" className="h-full w-full object-contain" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-primary/10 text-primary">
            <span className="text-lg font-bold">Momentos</span>
          </div>
        )}
      </div>
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

function PageFace({ src, pageNum }: { src: string; pageNum: number }) {
  return (
    <div className="relative h-full w-full bg-white shadow-sm">
      <div className="absolute inset-[10%] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`Página ${pageNum}`} className="h-full w-full object-contain" />
      </div>
      <span className="absolute bottom-2 right-3 text-[9px] text-gray-400">
        {pageNum}
      </span>
    </div>
  );
}

function BlankFace() {
  return <div className="h-full w-full bg-white shadow-sm" />;
}

function BackCoverFace() {
  return (
    <div className="h-full w-full bg-gray-100 shadow-sm grid place-items-center">
      <span className="text-xs text-gray-400">Momentos</span>
    </div>
  );
}
