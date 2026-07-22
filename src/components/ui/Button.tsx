import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline" | "subtle";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark active:bg-brand-dark shadow-sm",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 shadow-sm",
  subtle: "bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-200",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm",
  outline: "border border-red-300 bg-white text-red-600 hover:bg-red-50 active:bg-red-100",
  ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200",
};

// Touch targets come first: every size is at least 44px tall on a phone, then
// tightens up at `sm` where there is a mouse and screen space is cheaper.
const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-xs gap-1.5 sm:h-8",
  md: "h-11 px-4 text-sm gap-2 sm:h-10",
  lg: "h-12 px-5 text-base gap-2 sm:h-11",
  icon: "h-11 w-11 sm:h-9 sm:w-9",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    loading,
    fullWidth,
    leftIcon,
    className,
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl font-medium",
        "transition-[background-color,border-color,color,transform] duration-150",
        // A tiny press-down is the only tactile feedback a touchscreen can give.
        "active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-60 disabled:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : leftIcon}
      {children}
    </button>
  );
});
