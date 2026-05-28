"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
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
 *
 * Link-based back/continue use `router.push` inside `useTransition` so we
 * can show a spinner during the gap between click and the new page
 * rendering — that gap is most painful on mobile and explains why the
 * UI used to feel unresponsive.
 */
export function StepNav({ back, next, className }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Tracks which side initiated the transition so only the clicked button
  // shows the spinner — the other one stays interactive in case the user
  // changes their mind before the navigation lands.
  const [navTarget, setNavTarget] = useState<"back" | "next" | null>(null);

  function navigate(target: "back" | "next", href: string) {
    return (e: React.MouseEvent) => {
      if (isPending) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      setNavTarget(target);
      startTransition(() => router.push(href));
    };
  }

  const backPending = isPending && navTarget === "back";
  const nextLinkPending = isPending && navTarget === "next";

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
          onClick={navigate("back", back.href)}
          aria-disabled={backPending || undefined}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "gap-2",
            backPending && "pointer-events-none opacity-70",
          )}
        >
          {backPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowLeft className="h-4 w-4" />
          )}
          {back.label ?? "Atrás"}
        </Link>
      ) : (
        <span />
      )}

      {next ? renderNext(next, navigate, nextLinkPending) : <span />}
    </div>
  );
}

function renderNext(
  next: NextProps,
  navigate: (target: "back" | "next", href: string) => (e: React.MouseEvent) => void,
  linkPending: boolean,
) {
  if ("node" in next) return next.node;

  if ("href" in next) {
    return (
      <Link
        href={next.href}
        onClick={navigate("next", next.href)}
        aria-disabled={next.disabled || linkPending || undefined}
        className={cn(
          buttonVariants({ variant: "default" }),
          "gap-2",
          (next.disabled || linkPending) && "pointer-events-none opacity-70",
        )}
      >
        {linkPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : null}
        {next.label ?? "Continuar"}
        {linkPending ? null : <ArrowRight className="h-4 w-4" />}
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
        {next.pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            {next.label ?? "Continuar"}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
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
      {next.pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Guardando...
        </>
      ) : (
        <>
          {next.label ?? "Continuar"}
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </Button>
  );
}
