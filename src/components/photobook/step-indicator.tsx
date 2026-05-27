import Link from "next/link";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "portada", label: "Portada" },
  { key: "paginas", label: "Páginas" },
  { key: "preview", label: "Vista previa" },
] as const;

type Props = {
  projectId: string;
  current: (typeof STEPS)[number]["key"];
};

export function StepIndicator({ projectId, current }: Props) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <nav className="flex items-center justify-center gap-2 py-4">
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-8 sm:w-12",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <Link
              href={`/fotolibro/${projectId}/${step.key}`}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active && "bg-primary text-primary-foreground",
                done && "bg-primary/10 text-primary",
                !active && !done && "bg-muted text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold",
                  active && "bg-primary-foreground/20",
                  done && "bg-primary/20",
                  !active && !done && "bg-muted-foreground/20",
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
