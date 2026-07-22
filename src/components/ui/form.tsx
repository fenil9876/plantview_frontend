import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

// Font size is set globally in index.css (16px on phones so iOS does not zoom,
// 14px from `sm` up), so it is deliberately absent here.
const base =
  "w-full rounded-xl border bg-white px-3.5 text-slate-900 shadow-sm transition-colors " +
  "placeholder:text-slate-400 focus:outline-none focus:ring-4 " +
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

// 44px on touch, 40px once there is a pointer.
const height = "h-11 sm:h-10";

function ring(invalid?: boolean) {
  return invalid
    ? "border-red-400 focus:border-red-500 focus:ring-red-500/15"
    : "border-slate-300 hover:border-slate-400 focus:border-brand focus:ring-brand/15";
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, type, inputMode, ...props }, ref) {
  // Quantities are typed on a phone all day: open the numeric keypad by
  // default rather than the full QWERTY one. Callers can still override.
  const mode = inputMode ?? (type === "number" ? "decimal" : undefined);
  return (
    <input
      ref={ref}
      type={type}
      inputMode={mode}
      className={cn(base, height, ring(invalid), className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea ref={ref} className={cn(base, "py-2.5", ring(invalid), className)} rows={3} {...props} />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          base,
          height,
          ring(invalid),
          // Native picker is kept (it is the best control on a phone); only the
          // closed-state chrome is restyled.
          "appearance-none pr-10",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      >
        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
});

export function Label({
  children,
  required,
  htmlFor,
}: {
  children: ReactNode;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
      {children}
      {required && (
        <span className="text-red-500" aria-label="required">
          {" *"}
        </span>
      )}
    </label>
  );
}

/** Label + control + hint/error wrapper. */
export function Field({
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label required={required}>{label}</Label>}
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
