import React, { useEffect } from "react";
import { Gift, X } from "lucide-react";

// Modern top banner (no sound). Slides in and is very visible without being intrusive.
export default function LiveTipToast({ tip, onClose, duration = 8000 }) {
  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [tip, onClose, duration]);

  if (!tip) return null;

  const amount = Number(tip.amount || 0);
  const supporter = tip.supporter_name || "Anonymous";
  let message = tip.message || tip.note;
  if (message && message.length > 160) {
    message = message.slice(0, 157) + "…";
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] px-3 sm:px-4">
      <style>{`
        @keyframes tc-slide-down { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes tc-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
        @keyframes tc-progress { from { width: 100%; } to { width: 0%; } }
      `}</style>
      <div className="mx-auto max-w-5xl mt-3 rounded-2xl border shadow-lg overflow-hidden animate-[tc-slide-down_220ms_ease-out] bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 text-white">
        {/* Progress bar at top */}
        <div className="h-1 bg-white/60">
          <div
            className="h-1 bg-white"
            style={{ width: '100%', animation: 'tc-progress linear forwards', animationDuration: `${duration}ms` }}
          />
        </div>
        <div className="p-3 sm:p-4 flex items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0 animate-[tc-pulse_1600ms_ease-in-out_infinite]">
            <Gift className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm sm:text-base">
              <span className="font-semibold">{supporter}</span>{" "}
              just tipped <span className="font-semibold tabular-nums">GH₵ {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {message ? (
              <div className="mt-1 text-xs sm:text-sm text-white/90 whitespace-pre-wrap break-words">“{message}”</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
