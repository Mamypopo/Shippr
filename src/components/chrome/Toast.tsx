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
 * A minimal, in-flow notice — not a floating toast card.
 *
 * The first version of this used the default UI-kit toast: a shadowed white
 * card, bottom-right, with a coloured left border. Nothing else on this site
 * has a shadow or floats above the page, so it read as bolted on from
 * somewhere else. This version reuses the one accent language the rest of
 * the interface already has — a coloured left border over a faint wash,
 * exactly as `IndexBand` flags a stale or volatile reading — and sits as a
 * real element in the page between the header and the content, the way a
 * server-rendered flash message would, rather than overlaying anything.
 */

export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: ToastItem[];
  show: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** How long a notice stays before it dismisses itself. Errors linger longer. */
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

  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast() / <ToastViewport> must be used inside <ToastProvider>.");
  }
  return ctx;
}

/** `toast.success(...)` / `toast.error(...)` / `toast.info(...)`. */
export function useToast() {
  const { show } = useToastContext();

  return useMemo(
    () => ({
      success: (message: string) => show(message, "success"),
      error: (message: string) => show(message, "error"),
      info: (message: string) => show(message, "info"),
    }),
    [show],
  );
}

const VARIANT_STYLE: Record<ToastVariant, { accent: string; wash: string }> = {
  success: { accent: "var(--color-ok)", wash: "var(--color-ok-wash)" },
  error: { accent: "var(--color-bad)", wash: "var(--color-bad-wash)" },
  info: { accent: "var(--color-ink)", wash: "var(--color-surface)" },
};

/**
 * Renders the current notices in place. Mounted once, between the header and
 * the page content, so a notice pushes the layout down by its own height
 * rather than floating over whatever happens to be underneath it.
 */
export function ToastViewport() {
  const { toasts, dismiss } = useToastContext();

  if (toasts.length === 0) return null;

  return (
    // `sticky top-0`, same as the header: stacked sticky siblings resolve
    // their offsets in document order, so this pins directly under the
    // header with no pixel math, and a notice stays visible even if the
    // action that triggered it happened after scrolling down a long form.
    <div className="sticky top-0 z-10" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const style = VARIANT_STYLE[toast.variant];

        return (
          <div
            key={toast.id}
            role={toast.variant === "error" ? "alert" : "status"}
            className="toast-enter border-b border-line"
            style={{ background: style.wash, borderLeft: `3px solid ${style.accent}` }}
          >
            <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-2.5 sm:px-8">
              <p className="flex-1 text-small text-ink">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="ปิดการแจ้งเตือน"
                className="shrink-0 text-ink-faint transition-colors hover:text-ink"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
