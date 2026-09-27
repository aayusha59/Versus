import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { Side } from "@/lib/types";

type Variant = "primary" | "outline" | "ghost" | "bracket";
type Size = "sm" | "md" | "lg";

interface BaseProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  /** Colour the button for a fighter: "a" green, "b" red. */
  side?: Side;
  className?: string;
  children: ReactNode;
}

type ButtonProps = BaseProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

function classes({ variant = "outline", size = "md", block, side, className }: BaseProps) {
  return cx(
    "btn",
    `btn-${variant}`,
    size !== "md" && `btn-${size}`,
    block && "btn-block",
    side && `side-${side}`,
    className,
  );
}

export function Button({ variant, size, block, side, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={classes({ variant, size, block, side, className, children })} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant,
  size,
  block,
  side,
  className,
  children,
}: BaseProps & { href: string }) {
  return (
    <Link href={href} className={classes({ variant, size, block, side, className, children })}>
      {children}
    </Link>
  );
}
