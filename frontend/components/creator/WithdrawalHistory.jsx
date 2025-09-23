import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  // Pagination size (always 4 per page)
  const pageSize = 4;
  const [page, setPage] = useState(1);

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

  const withdrawals = useMemo(() => {
    const list = Array.isArray(transactions)
      ? transactions.filter((t) => t.transaction_type === "withdrawal")
      : [];
    return list.sort((a, b) => (b.created_date || 0) - (a.created_date || 0));
  }, [transactions]);
  // Reset to page 1 when data changes
  useEffect(() => { setPage(1); }, [withdrawals.length]);

  const totalPages = Math.max(1, Math.ceil(withdrawals.length / pageSize));
  const clampedPage = Math.min(totalPages, Math.max(1, page));
  const start = (clampedPage - 1) * pageSize;
  const visible = withdrawals.slice(start, start + pageSize);
  const showingFrom = withdrawals.length === 0 ? 0 : start + 1;
  const showingTo = Math.min(withdrawals.length, start + visible.length);

  // Page window (mobile fewer buttons)
  const windowCount = isMobile ? 3 : 5;
  const half = Math.floor(windowCount / 2);
  let winStart = Math.max(1, clampedPage - half);
  let winEnd = Math.min(totalPages, winStart + windowCount - 1);
  winStart = Math.max(1, winEnd - windowCount + 1);
  const pages = [];
  for (let i = winStart; i <= winEnd; i++) pages.push(i);

  return (
    <Card className="border-none shadow-lg w-full overflow-hidden">
      <CardHeader>
        <CardTitle>Withdrawal History</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-hidden">
        {visible.length === 0 ? (
          <p className="text-gray-600">No withdrawals yet.</p>
        ) : (
          <div className="relative">
            <ul className="space-y-3 w-full">
              {visible.map((t) => (
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
                          : t.status === "approved"
                          ? "bg-green-100 text-green-700 border border-green-400"
                          : "bg-green-50 text-green-700")
                      }
                    >
                      {t.status === "approved" ? "Approved" : t.status || "pending"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer: showing and pagination */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-xs text-gray-500">
            Showing {showingFrom}-{showingTo} of {withdrawals.length}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={clampedPage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {pages.map((p) => (
                <Button
                  key={p}
                  variant="outline"
                  size="sm"
                  className={
                    "rounded-full " +
                    (p === clampedPage
                      // Keep number clearly visible on mobile: darker text, subtle bg, solid border
                      ? "bg-gray-100 text-gray-900 border-gray-400"
                      : "bg-white text-gray-700")
                  }
                  onClick={() => setPage(p)}
                  aria-current={p === clampedPage ? "page" : undefined}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={clampedPage === totalPages}
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
