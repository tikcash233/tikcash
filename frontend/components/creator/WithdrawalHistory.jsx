import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownCircle } from "lucide-react";

export default function WithdrawalHistory({ transactions = [] }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 640px)");
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);

  const displayCount = isMobile ? 3 : 8;

  const formatDate = (val) => {
    const d = new Date(val || Date.now());
    const months = [
      "Jan.",
      "Feb.",
      "Mar.",
      "Apr.",
      "May.",
      "Jun.",
      "Jul.",
      "Aug.",
      "Sep.",
      "Oct.",
      "Nov.",
      "Dec.",
    ];
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = months[d.getMonth()];
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd} ${mm} ${yyyy}, ${hh}:${min}`;
  };

  const withdrawals = Array.isArray(transactions)
    ? transactions.filter((t) => t.transaction_type === "withdrawal")
    : [];
  const limited = withdrawals.slice(0, displayCount);

  return (
    <Card className="border-none shadow-lg w-full overflow-hidden">
      <CardHeader>
        <CardTitle>Withdrawal History</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-hidden">
        {limited.length === 0 ? (
          <p className="text-gray-600">No withdrawals yet.</p>
        ) : (
          <ul className="space-y-3 w-full">
            {limited.map((t) => (
              <li
                key={t.id}
                className="w-full max-w-full flex items-center gap-3 p-3 rounded-xl border bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ArrowDownCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    Withdrawal to {t.momo_number || "Mobile Money"}
                  </div>
                  {t.momo_number && (
                    <div className="text-xs text-gray-700 font-mono">
                      {t.momo_number}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 truncate">
                    {formatDate(t.created_date)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 ml-auto">
                  <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold whitespace-nowrap tabular-nums">
                    {`GH₵ ${Math.abs(Number(t.amount || 0)).toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                    )}`}
                  </span>
                  <span
                    className={
                      `px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ` +
                      (t.status === "pending"
                        ? "bg-yellow-50 text-yellow-700"
                        : t.status === "failed"
                        ? "bg-red-50 text-red-700"
                        : "bg-green-50 text-green-700")
                    }
                  >
                    {t.status || "pending"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
