/* @refresh reload */
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastCtx = createContext({ success: () => {}, error: () => {}, info: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const add = useCallback((variant, message, duration = 3000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, variant, message }]);
    window.setTimeout(() => remove(id), duration);
  }, [remove]);

  const api = useMemo(() => ({
    // Default success toast lasts longer (6s) so users can read it fully
    success: (m, d) => add("success", m, d ?? 6000),
    error: (m, d) => add("error", m, d),
    info: (m, d) => add("info", m, d),
  }), [add]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <Toaster toasts={toasts} onDismiss={remove} />
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

function Toaster({ toasts, onDismiss }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            "rounded-md shadow-lg px-4 py-3 text-sm text-white flex items-start gap-3",
            t.variant === "success" && "bg-emerald-600",
            t.variant === "error" && "bg-red-600",
            t.variant === "info" && "bg-slate-800",
          ].filter(Boolean).join(" ")}
          role="status"
        >
          <span className="mt-0.5">
            {t.variant === "success" ? "✓" : t.variant === "error" ? "!" : "•"}
          </span>
          <div className="flex-1">{t.message}</div>
          <button className="opacity-80 hover:opacity-100" onClick={() => onDismiss(t.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}
