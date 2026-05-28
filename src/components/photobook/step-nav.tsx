"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NextProps =
  | {
      /** Plain navigation to a URL. */
      href: string;
      label?: string;
      disabled?: boolean;
    }
  | {
      /** Form submit — pair with a form id elsewhere on the page. */
      type: "submit";
      form?: string;
      label?: string;
      disabled?: boolean;
      pending?: boolean;
    }
  | {
      /** Custom handler — typically wires to the step's save action. */
      onClick: () => void;
      label?: string;
      disabled?: boolean;
      pending?: boolean;
    }
  | {
      /** Render an arbitrary node in place of the Continuar button. */
      node: React.ReactNode;
    };

type Props = {
  back?: { href: string; label?: string };
  next?: NextProps;
  className?: string;
};

/**
 * Shared back / continue bar shown at the bottom of every photobook step
 * so navigation is always visible and consistent. The "next" slot is
 * polymorphic so steps that need to save before navigating, submit a form,
 * or render a special CTA (add to cart) can all reuse the same chrome.
 */
export function StepNav({ back, next, className }: Props) {
  return (
    <div
      className={cn(
        "mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6",
        className,
      )}
    >
      {back ? (
        <Link
          href={back.href}
          className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
        >
          <ArrowLeft className="h-4 w-4" />
          {back.label ?? "Atrás"}
        </Link>
      ) : (
        <span />
      )}

      {next ? renderNext(next) : <span />}
    </div>
  );
}

function renderNext(next: NextProps) {
  if ("node" in next) return next.node;

  if ("href" in next) {
    return (
      <Link
        href={next.href}
        aria-disabled={next.disabled || undefined}
        className={cn(
          buttonVariants({ variant: "default" }),
          "gap-2",
          next.disabled && "pointer-events-none opacity-50",
        )}
      >
        {next.label ?? "Continuar"}
        <ArrowRight className="h-4 w-4" />
      </Link>
    );
  }

  if ("type" in next) {
    return (
      <Button
        type="submit"
        form={next.form}
        disabled={next.disabled || next.pending}
        className="gap-2"
      >
        {next.pending ? "Guardando..." : (next.label ?? "Continuar")}
        <ArrowRight className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      onClick={next.onClick}
      disabled={next.disabled || next.pending}
      className="gap-2"
    >
      {next.pending ? "Guardando..." : (next.label ?? "Continuar")}
      <ArrowRight className="h-4 w-4" />
    </Button>
  );
}
