import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

type Size = "sm" | "md" | "lg";
const SIZES: Record<Size, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-2xl",
  lg: "sm:max-w-4xl",
};

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: Size;
}

/**
 * Bottom sheet on phones, centred dialog from `sm` up.
 *
 * The sheet form matters more than it looks: a centred dialog puts its buttons
 * in the middle of the screen, which is the hardest place to reach one-handed,
 * and it fights the on-screen keyboard. Anchoring to the bottom edge keeps the
 * actions under the thumb and lets the panel shrink as the keyboard opens.
 */
export function Modal({ open, onClose, title, description, children, footer, size = "md" }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-pop",
          "animate-sheet-up sm:max-h-[85dvh] sm:rounded-2xl sm:animate-scale-in",
          SIZES[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab handle — signals "this panel came from the bottom edge". */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        {(title || description) && (
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-6 sm:py-4">
            <div className="min-w-0">
              {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="-m-1.5 shrink-0 rounded-xl p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Only the body scrolls, so the title and actions stay put.
            `overscroll-contain` stops the page behind from scrolling too. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          {children}
        </div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.875rem)] sm:px-6 sm:py-4 sm:pb-4">
            {footer}
          </div>
        )}
        {/* Without a footer the body still needs to clear the home indicator. */}
        {!footer && <div className="h-[env(safe-area-inset-bottom,0px)] sm:hidden" />}
      </div>
    </div>
  );
}
