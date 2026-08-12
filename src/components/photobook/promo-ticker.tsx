"use client";

import { useEffect, useRef, useState } from "react";
import { Tag } from "lucide-react";
import { cn, formatMXN } from "@/lib/utils";

/** Pixels per second. Slow enough to read, fast enough not to feel stuck. */
const SCROLL_SPEED = 45;

type Promo = { label: string; amount: number };

/**
 * Right-to-left ticker over the promos that apply to the configured book.
 *
 * Two problems in one: promo labels are admin-authored free text and can be
 * far longer than the bar is wide, and more than one promo can apply at once.
 * Scrolling solves both — everything gets its turn on screen regardless of
 * length or count.
 *
 * Only scrolls when it needs to (content wider than the bar, or more than one
 * promo). A single short label sits still, because motion with nothing to
 * reveal is just noise.
 */
export function PromoTicker({ promos }: { promos: Promo[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(false);
  const [duration, setDuration] = useState(18);

  useEffect(() => {
    const viewport = viewportRef.current;
    const copy = copyRef.current;
    if (!viewport || !copy) return;

    // Measure the first copy rather than halving the track: the second copy
    // only exists once we've decided to scroll, so halving would misjudge the
    // very first measurement and could latch the ticker off.
    const measure = () => {
      const copyWidth = copy.offsetWidth;
      setScroll(copyWidth > viewport.clientWidth || promos.length > 1);
      setDuration(Math.max(8, copyWidth / SCROLL_SPEED));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [promos]);

  if (promos.length === 0) return null;

  const items = promos.map((p) => (
    <span key={p.label} className="inline-flex items-center gap-1.5 px-3">
      <Tag className="h-3.5 w-3.5 shrink-0" />
      <span>{p.label}</span>
      <span className="font-semibold">−{formatMXN(p.amount)}</span>
    </span>
  ));

  return (
    <div
      ref={viewportRef}
      className={cn(
        "group mt-2 overflow-hidden text-xs font-medium text-primary",
        // Soften the cut at both edges so text fades rather than clipping.
        scroll &&
          "[mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)]",
      )}
    >
      <div
        style={
          scroll
            ? ({ "--marquee-duration": `${duration}s` } as React.CSSProperties)
            : undefined
        }
        className={cn(
          "flex w-max items-center",
          scroll
            ? "animate-marquee group-hover:[animation-play-state:paused]"
            : "mx-auto",
        )}
      >
        <div ref={copyRef} className="flex items-center">
          {items}
        </div>
        {/* Second copy: what the loop wraps onto, so translateX(-50%) lands
            exactly on the start of the text again. Only rendered while
            scrolling, and hidden from assistive tech since it's a duplicate. */}
        {scroll ? (
          <div aria-hidden className="flex items-center">
            {items}
          </div>
        ) : null}
      </div>
    </div>
  );
}
