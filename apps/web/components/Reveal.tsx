import { createElement, type CSSProperties, type ElementType, type ReactNode } from "react";
import { cx } from "@/lib/cx";

interface RevealProps {
  /** Stagger index; each step adds 40ms. */
  i?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  id?: string;
}

/** Page-load reveal: opacity 0 to 1, translateY 8px to 0, 360ms, once. */
export function Reveal({ i = 0, as = "div", className, style, children, ...rest }: RevealProps) {
  return createElement(
    as,
    {
      className: cx("reveal", className),
      style: { ...style, "--i": i } as CSSProperties,
      ...rest,
    },
    children,
  );
}
