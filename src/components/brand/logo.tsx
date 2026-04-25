import Image from "next/image";

import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "default" | "white";
  size?: number;
  className?: string;
  showWordmark?: boolean;
}

export function Logo({
  variant = "default",
  size = 36,
  className,
  showWordmark = true,
}: LogoProps) {
  const src = variant === "white" ? "/airavat-logo-white.svg" : "/airavat-logo.svg";

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src={src}
        width={size}
        height={size}
        alt="AiravatL"
        priority
        className="select-none"
      />
      {showWordmark && (
        <span
          className={cn(
            "text-base font-semibold tracking-tight",
            variant === "white" ? "text-white" : "text-foreground",
          )}
        >
          AiravatL Enterprise
        </span>
      )}
    </span>
  );
}
