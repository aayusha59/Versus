import type { InputHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: ReactNode;
}

/** Label above in caps, the control below, an error in vermilion under it. No box. */
export function Field({ id, label, hint, error, className, children }: FieldProps) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label">
          {label}
        </label>
        {hint ? <span className="text-xs text-ink-2">{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export function Input({ className, invalid, ...rest }: InputProps) {
  return <input className={cx("field-input", className)} aria-invalid={invalid || undefined} {...rest} />;
}
