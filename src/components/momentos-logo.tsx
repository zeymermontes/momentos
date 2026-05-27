import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  variant?: "image" | "inverse";
  size?: string;
};

export function MomentosLogo({
  className,
  variant = "image",
  size = "h-10 w-40",
}: Props) {
  if (variant === "inverse") {
    return (
      <span
        className={cn(
          "relative inline-block overflow-hidden align-middle",
          size,
          className,
        )}
      >
        <Image
          src="/momentos-logo-white.png"
          alt="Momentos"
          fill
          priority
          sizes="240px"
          className="object-contain select-none"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative inline-block overflow-hidden align-middle",
        size,
        className,
      )}
    >
      <Image
        src="/momentos-logo.png"
        alt="Momentos"
        fill
        priority
        sizes="240px"
        className="object-contain select-none"
      />
    </span>
  );
}
