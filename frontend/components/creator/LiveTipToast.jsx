import React, { useEffect } from "react";
import { Gift, X } from "lucide-react";

export default function LiveTipToast({ tip, onClose, soundEnabled = true, duration = 7000 }) {
  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [tip, onClose, duration]);

  // Optional short “ding” using WebAudio
  useEffect(() => {
    if (!tip || !soundEnabled) return;
    let ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.45);
    } catch {}
    return () => {
      try { ctx && ctx.close && ctx.close(); } catch {}
    };
  }, [tip, soundEnabled]);

  if (!tip) return null;

  const amount = Number(tip.amount || 0);
  const supporter = tip.supporter_name || "Anonymous";
  const message = tip.message || tip.note;

  return (
    <div className="fixed z-50 top-4 right-4 left-4 sm:left-auto sm:right-6 sm:top-6">
      <style>{`
        @keyframes tc-toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div className="mx-auto sm:mx-0 w-full sm:w-[360px] rounded-2xl border bg-white shadow-xl ring-1 ring-black/5 overflow-hidden animate-[tc-toast-in_180ms_ease-out]">
        <div className="p-3 sm:p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">{supporter}</span>{" "}
              just tipped{" "}
              <span className="font-semibold text-gray-900 tabular-nums">
                GH₵ {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {message ? (
              <div className="mt-1 text-sm text-gray-800 whitespace-pre-wrap break-words">“{message}”</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
