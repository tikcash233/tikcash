import React, { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatCedi(v) {
	const n = Number(v || 0);
	return `GH₵ ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MONTHS = [
	"Jan.", "Feb.", "Mar.", "Apr.", "May.", "Jun.",
	"Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."
];

function startOfDay(d) {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	return x;
}
function startOfISOWeek(d) {
	const x = startOfDay(d);
	const day = (x.getDay() + 6) % 7; // Mon=0 ... Sun=6
	x.setDate(x.getDate() - day);
	return x;
}
function startOfMonth(d) {
	const x = startOfDay(d);
	x.setDate(1);
	return x;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addWeeks(d, n) { return addDays(d, n * 7); }
function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return startOfMonth(x); }
function isoDate(d) { return startOfDay(d).toISOString().slice(0, 10); }
function monthKey(d) { const x = startOfMonth(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; }
function weekKey(d) { return isoDate(startOfISOWeek(d)); }
function humanLabel(d, granularity) {
	const x = new Date(d);
	if (granularity === "day") return `${String(x.getDate()).padStart(2, "0")} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
	if (granularity === "week") return `Week of ${String(x.getDate()).padStart(2, "0")} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
	return `${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
}
function humanTick(d, granularity) {
	const x = new Date(d);
	if (granularity === "day") return `${String(x.getMonth() + 1).padStart(2, "0")}/${String(x.getDate()).padStart(2, "0")}`;
	if (granularity === "week") return `${String(x.getMonth() + 1).padStart(2, "0")}/${String(x.getDate()).padStart(2, "0")}`;
	return `${MONTHS[x.getMonth()]}`;
}

export default function PerformanceChart({ transactions = [] }) {
	/*
	Regression Safeguard Note:
	The dashboard previously passed only the last 50 transactions to this component. When a NEW tip arrived,
	the oldest transaction could fall out of that 50-item window. If that oldest transaction was the ONLY tip
	for (say) 11 Sep 2025, its bucket total appeared to *decrease* (from that amount to 0) causing the chart
	to visually “lose” money on that earlier day.

	Fix implemented in CreatorDashboard.jsx:
	- Introduced a dedicated `performanceTransactions` state that loads a much larger history (up to 1000 items)
	  and is never truncated to 50.
	- The recent transactions list still shows only up to 50 for UI performance, but the chart now receives
	  the stable full history so historical day/period totals never change when new data arrives.

	If you modify the data source again, ensure this component always gets *all* historical tips needed for
	the displayed range or explicitly fetch aggregated stats from the backend.
	*/
	// Production friendly: minimal dev logging (remove or keep guarded)
	if (import.meta.env.DEV && transactions.length === 0) {
		console.debug('[PerformanceChart] No transactions loaded yet');
	}

	// Toggle to bucket by UTC midnight instead of local (helps when users in different TZs)
	const USE_UTC_BUCKETS = true;

	// Normalize status coming from backend / paystack variants
	const normalizeStatus = (s) => {
		const v = (s || '').toLowerCase();
		if (["completed", "success", "paid"].includes(v)) return "completed";
		if (["failed", "error"].includes(v)) return "failed";
		return v; // pending, expired, etc.
	};
	
	// Controls
	const [granularity, setGranularity] = useState("day"); // 'day' | 'week' | 'month'
	// Default to 7d instead of 30d
	const [rangeKey, setRangeKey] = useState("7d"); // day: 7d/30d/all, week: 12w/all, month: 12m/all
	const [activeOnly, setActiveOnly] = useState(false);
	const [hoverX, setHoverX] = useState(null);
	const containerRef = useRef(null);

	// Normalize transactions to completed tips; treat success/paid as completed
	const tips = useMemo(() => {
		const included = [];
		for (const t of transactions) {
			if (!t || t.transaction_type !== 'tip') continue;
			const norm = normalizeStatus(t.status);
			if (norm !== 'completed') continue; // ignore pending/failed/expired
			const rawDate = new Date(t.created_date || Date.now());
			let bucketDate;
			if (USE_UTC_BUCKETS) {
				// Convert to YYYY-MM-DD in UTC then back to a Date at 00:00 UTC for consistent grouping
				const iso = rawDate.toISOString().slice(0, 10); // yyyy-mm-dd
				bucketDate = new Date(iso + 'T00:00:00.000Z');
			} else {
				bucketDate = startOfDay(rawDate);
			}
			// Use creator_amount (what the creator actually receives) when available.
			included.push({
				amount: Number((t.creator_amount != null) ? t.creator_amount : t.amount || 0),
				date: bucketDate,
				created_date: t.created_date
			});
		}
		if (import.meta.env.DEV && included.length) {
			const total = included.reduce((s, x) => s + x.amount, 0);
			console.debug('[PerformanceChart] Included completed tips:', included.length, 'Total:', total);
		}
		return included;
	}, [transactions, USE_UTC_BUCKETS]);

	const hasData = tips.length > 0;
	const latestDate = useMemo(() => (hasData ? tips.reduce((a, b) => (a > b.date ? a : b.date), tips[0].date) : new Date()), [tips, hasData]);
	const earliestDate = useMemo(() => (hasData ? tips.reduce((a, b) => (a < b.date ? a : b.date), tips[0].date) : new Date()), [tips, hasData]);

	// Aggregate by granularity
	const sumByBucket = useMemo(() => {
		const m = new Map();
		for (const t of tips) {
			let key;
			if (granularity === 'day') key = isoDate(t.date); // already UTC-normalized if toggle on
			else if (granularity === 'week') key = weekKey(t.date);
			else key = monthKey(t.date);
			m.set(key, (m.get(key) || 0) + t.amount);
		}
		return m;
	}, [tips, granularity]);

	// Range
	const { rangeStart, rangeEnd } = useMemo(() => {
		if (!hasData) {
			const today = startOfDay(new Date());
			return { rangeStart: today, rangeEnd: today };
		}
		let end = startOfDay(latestDate);
		if (granularity === "day") {
			if (rangeKey === "7d") return { rangeStart: addDays(end, -6), rangeEnd: end };
			if (rangeKey === "all") return { rangeStart: startOfDay(earliestDate), rangeEnd: end };
			return { rangeStart: addDays(end, -29), rangeEnd: end };
		}
		if (granularity === "week") {
			end = startOfISOWeek(end);
			if (rangeKey === "12w") return { rangeStart: addWeeks(end, -11), rangeEnd: end };
			const start = startOfISOWeek(earliestDate);
			return { rangeStart: start, rangeEnd: end };
		}
		// month
		end = startOfMonth(end);
		if (rangeKey === "12m") return { rangeStart: addMonths(end, -11), rangeEnd: end };
		const start = startOfMonth(earliestDate);
		return { rangeStart: start, rangeEnd: end };
	}, [hasData, latestDate, earliestDate, granularity, rangeKey]);

	// Build continuous series between start/end
	const series = useMemo(() => {
		const out = [];
		if (!hasData) return out;
		let cursor = new Date(rangeStart);
		while (cursor <= rangeEnd) {
			let key, next;
			if (granularity === "day") { key = isoDate(cursor); next = addDays(cursor, 1); }
			else if (granularity === "week") { key = weekKey(cursor); next = addWeeks(cursor, 1); }
			else { key = monthKey(cursor); next = addMonths(cursor, 1); }
			out.push({ key, amount: sumByBucket.get(key) || 0, labelDate: new Date(cursor) });
			cursor = next;
		}
		return out;
	}, [sumByBucket, rangeStart, rangeEnd, hasData, granularity]);

	// Active-only filter
	const dSeries = useMemo(() => (activeOnly ? series.filter((d) => d.amount > 0) : series), [series, activeOnly]);

	// Totals (range + lifetime)
	const totals = useMemo(() => {
		const sum = dSeries.reduce((s, d) => s + d.amount, 0);
		const max = Math.max(0, ...dSeries.map((d) => d.amount));
		const best = dSeries.reduce((acc, d) => (d.amount > (acc?.amount || 0) ? d : acc), null);
		const lifetime = tips.reduce((s, t) => s + t.amount, 0);
		return { sum, max, best, lifetime };
	}, [dSeries, tips]);

	// Chart dims and scales
	const width = 800;
	const height = 220;
	const pad = 24;
	const innerW = width - pad * 2;
	const innerH = height - pad * 2;
	const maxY = Math.max(10, totals.max * 1.1);
	const xStep = dSeries.length > 1 ? innerW / (dSeries.length - 1) : 0;
	const yScale = (v) => innerH - (v / maxY) * innerH;

	const linePath = useMemo(() => {
		if (dSeries.length === 0) return "";
		const parts = dSeries.map((d, i) => `${i === 0 ? "M" : "L"} ${pad + i * xStep} ${pad + yScale(d.amount)}`);
		return parts.join(" ");
	}, [dSeries, xStep]);

	const areaPath = useMemo(() => {
		if (dSeries.length === 0) return "";
		const top = dSeries.map((d, i) => `${i === 0 ? "M" : "L"} ${pad + i * xStep} ${pad + yScale(d.amount)}`).join(" ");
		const bottom = `L ${pad + (dSeries.length - 1) * xStep} ${pad + innerH} L ${pad} ${pad + innerH} Z`;
		return `${top} ${bottom}`;
	}, [dSeries, xStep, innerH]);

	// Hover / touch
	const onPosChange = (clientX, currentTarget) => {
		const rect = currentTarget.getBoundingClientRect();
		const x = clientX - rect.left;
		setHoverX(Math.max(pad, Math.min(width - pad, x)));
	};
	const onMouseMove = (e) => onPosChange(e.clientX, e.currentTarget);
	const onMouseLeave = () => setHoverX(null);
	const onTouchMove = (e) => { const t = e.touches[0]; if (t) onPosChange(t.clientX, e.currentTarget); };
	const onTouchEnd = () => setHoverX(null);

	const hoverIndex = useMemo(() => {
		if (hoverX == null || xStep === 0) return null;
		const rel = hoverX - pad;
		const idx = Math.round(rel / xStep);
		return Math.max(0, Math.min(dSeries.length - 1, idx));
	}, [hoverX, xStep, dSeries.length]);
	const hoverPoint = hoverIndex != null ? dSeries[hoverIndex] : null;

	const rangeButtons =
		granularity === "day"
			? [ { key: "7d", label: "7D" }, { key: "30d", label: "30D" }, { key: "all", label: "All" } ]
			: granularity === "week"
			? [ { key: "12w", label: "12W" }, { key: "all", label: "All" } ]
			: [ { key: "12m", label: "12M" }, { key: "all", label: "All" } ];

	return (
		<Card className="border-none shadow-lg w-full overflow-hidden">
			<CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				<CardTitle>Performance</CardTitle>
				<div className="flex flex-wrap items-center gap-2">
					{/* Granularity */}
					<div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
						{[{ key: "day", label: "Day" }, { key: "week", label: "Week" }, { key: "month", label: "Month" }].map((g) => (
							<button
								key={g.key}
								className={`px-3 py-1.5 text-sm font-medium ${granularity === g.key ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
								onClick={() => { setGranularity(g.key); if (g.key === "day") setRangeKey("30d"); else if (g.key === "week") setRangeKey("12w"); else setRangeKey("12m"); }}
							>
								{g.label}
							</button>
						))}
					</div>

					{/* Range */}
					<div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
						{rangeButtons.map((r) => (
							<button
								key={r.key}
								className={`px-3 py-1.5 text-sm font-medium ${rangeKey === r.key ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
								onClick={() => setRangeKey(r.key)}
							>
								{r.label}
							</button>
						))}
					</div>

					{/* Active only */}
					<button
						className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${activeOnly ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-700 hover:bg-gray-50 border-gray-300"}`}
						onClick={() => setActiveOnly((v) => !v)}
						title="Show only periods with tips"
					>
						{activeOnly ? "Active Only" : "All Periods"}
					</button>
				</div>
			</CardHeader>
			<CardContent>
				<div className="text-xs text-gray-400 mb-2">Chart shows net amounts (after platform fees: 18% platform + 2% processor fee — 20% total).</div>
				{!hasData ? (
					<p className="text-gray-600">No performance data yet.</p>
				) : dSeries.length === 0 ? (
					<p className="text-gray-600">No data in this range.</p>
				) : (
					<div ref={containerRef} className="w-full min-w-0">
						<div className="flex flex-wrap items-center gap-4 mb-3 text-sm">
							<span className="text-gray-700">Range Total: <strong>{formatCedi(totals.sum)}</strong></span>
							<span className="text-gray-700">Lifetime: <strong>{formatCedi(totals.lifetime)}</strong></span>
							{totals.best && (
								<span className="text-gray-700">Best {granularity}: <strong>{formatCedi(totals.best.amount)}</strong> on <strong>{humanLabel(totals.best.labelDate || dSeries.find(d=>d.amount===totals.best.amount)?.labelDate, granularity)}</strong></span>
							)}
							<span className="text-gray-500">Shown: {dSeries.length} {granularity === "day" ? "days" : granularity === "week" ? "weeks" : "months"}</span>
							<span className="text-gray-400">(Totals reflect selected range)</span>
						</div>

						<div className="relative">
							<svg
								viewBox={`0 0 ${width} ${height}`}
								className="w-full h-56 sm:h-64 select-none"
								onMouseMove={onMouseMove}
								onMouseLeave={onMouseLeave}
								onTouchMove={onTouchMove}
								onTouchEnd={onTouchEnd}
							>
								<defs>
									<linearGradient id="perfFill" x1="0" x2="0" y1="0" y2="1">
										<stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
										<stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
									</linearGradient>
									<linearGradient id="perfLine" x1="0" x2="1" y1="0" y2="0">
										<stop offset="0%" stopColor="#2563eb" />
										<stop offset="100%" stopColor="#1d4ed8" />
									</linearGradient>
								</defs>

								{[0.25, 0.5, 0.75, 1].map((p, i) => (
									<line key={i} x1={pad} x2={width - pad} y1={pad + innerH * p} y2={pad + innerH * p} stroke="#e5e7eb" strokeWidth="1" />
								))}

								<path d={areaPath} fill="url(#perfFill)" />
								<path d={linePath} fill="none" stroke="url(#perfLine)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

								{dSeries.map((d, i) => (i % Math.max(1, Math.round(dSeries.length / 4)) === 0) ? (
									<g key={d.key} transform={`translate(${pad + i * xStep}, ${height - pad + 14})`}>
										<text textAnchor="middle" fontSize="10" fill="#6b7280">{humanTick(d.labelDate, granularity)}</text>
									</g>
								) : null)}

								{hoverPoint && (
									<g>
										<line x1={pad + hoverIndex * xStep} x2={pad + hoverIndex * xStep} y1={pad} y2={height - pad} stroke="#94a3b8" strokeDasharray="4 4" />
										<circle cx={pad + hoverIndex * xStep} cy={pad + yScale(hoverPoint.amount)} r="4" fill="#2563eb" stroke="#fff" strokeWidth="2" />
									</g>
								)}
							</svg>

							{hoverPoint && (
								<div className="absolute -translate-x-1/2 -translate-y-2 px-2 py-1 rounded-md bg-slate-800 text-white text-xs shadow" style={{ left: `${((pad + hoverIndex * xStep) / width) * 100}%`, top: 8 }}>
									<div className="font-semibold">{humanLabel(hoverPoint.labelDate, granularity)}</div>
									<div>{formatCedi(hoverPoint.amount)}</div>
								</div>
							)}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

