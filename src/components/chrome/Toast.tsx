"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * A minimal toast system.
 *
 * No dependency — this is a handful of forms with a "did it work" question
 * each, not a product that needs undo stacks, promise-chaining, or queued
 * action buttons. Three variants, auto-dismiss, one manual close.
 */

export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** How long a toast stays before it dismisses itself. Errors linger longer. */
const DURATION_MS: Record<ToastVariant, number> = {
  success: 3500,
  info: 3500,
  error: 6000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, variant }]);

      const timer = setTimeout(() => dismiss(id), DURATION_MS[variant]);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * `toast.success(...)` / `toast.error(...)` / `toast.info(...)`.
 *
 * Reaches for the context so call sites never see the plumbing; throws if
 * used outside the provider, which is a mistake worth catching at the call
 * site rather than silently dropping the message.
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast() must be called inside <ToastProvider>.");
  }

  return useMemo(
    () => ({
      success: (message: string) => ctx.show(message, "success"),
      error: (message: string) => ctx.show(message, "error"),
      info: (message: string) => ctx.show(message, "info"),
    }),
    [ctx],
  );
}

const VARIANT_ACCENT: Record<ToastVariant, string> = {
  success: "var(--color-ok)",
  error: "var(--color-bad)",
  info: "var(--color-ink)",
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.variant === "error" ? "alert" : "status"}
          className="toast pointer-events-auto flex w-full max-w-sm items-start gap-3 bg-ground px-4 py-3"
          style={{ borderLeft: `3px solid ${VARIANT_ACCENT[toast.variant]}` }}
        >
          <p className="flex-1 text-small leading-relaxed text-ink">{toast.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="ปิดการแจ้งเตือน"
            className="shrink-0 text-ink-faint transition-colors hover:text-ink"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
