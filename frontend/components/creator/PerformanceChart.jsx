import React, { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Calendar, Award } from "lucide-react";

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
		<Card className="border-none shadow-lg w-full overflow-hidden bg-gradient-to-br from-white to-blue-50/30">
			<CardHeader className="pb-3">
				<div className="flex items-center gap-2 mb-4">
					<div className="p-2 bg-blue-100 rounded-lg">
						<TrendingUp className="w-5 h-5 text-blue-600" />
					</div>
					<CardTitle className="text-xl">Performance Analytics</CardTitle>
				</div>

				{/* Mobile-First Controls */}
				<div className="space-y-3">
					{/* Granularity Selector - Full width on mobile */}
					<div className="flex flex-col sm:flex-row sm:items-center gap-2">
						<span className="text-xs font-medium text-gray-600 uppercase tracking-wide flex items-center gap-1">
							<Calendar className="w-3 h-3" />
							View By
						</span>
						<div className="grid grid-cols-3 gap-1 sm:inline-flex sm:rounded-lg sm:border sm:border-gray-200 sm:overflow-hidden sm:shadow-sm flex-1 sm:flex-none">
							{[{ key: "day", label: "Day" }, { key: "week", label: "Week" }, { key: "month", label: "Month" }].map((g) => (
								<button
									key={g.key}
									className={`px-3 py-2.5 sm:py-2 text-sm font-medium transition-all rounded-lg sm:rounded-none ${
										granularity === g.key 
											? "bg-blue-600 text-white shadow-md sm:shadow-none" 
											: "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 sm:border-0"
									}`}
									onClick={() => { 
										setGranularity(g.key); 
										if (g.key === "day") setRangeKey("7d"); 
										else if (g.key === "week") setRangeKey("12w"); 
										else setRangeKey("12m"); 
									}}
								>
									{g.label}
								</button>
							))}
						</div>
					</div>

					{/* Range & Active Filter - Side by side on mobile */}
					<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
						<span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Range</span>
						<div className="flex gap-1 sm:gap-2 flex-1 sm:flex-none">
							<div className="flex gap-1 flex-1 sm:inline-flex sm:rounded-lg sm:border sm:border-gray-200 sm:overflow-hidden sm:shadow-sm">
								{rangeButtons.map((r) => (
									<button
										key={r.key}
										className={`flex-1 sm:flex-none px-3 py-2.5 sm:py-2 text-sm font-medium transition-all rounded-lg sm:rounded-none ${
											rangeKey === r.key 
												? "bg-emerald-600 text-white shadow-md sm:shadow-none" 
												: "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 sm:border-0"
										}`}
										onClick={() => setRangeKey(r.key)}
									>
										{r.label}
									</button>
								))}
							</div>
							
							{/* Active Filter Button */}
							<button
								className={`px-3 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-all shadow-sm border ${
									activeOnly 
										? "bg-purple-600 text-white border-purple-600" 
										: "bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
								}`}
								onClick={() => setActiveOnly((v) => !v)}
								title="Show only periods with tips"
							>
								<span className="hidden sm:inline">{activeOnly ? "Active Only" : "All"}</span>
								<span className="sm:hidden">📊</span>
							</button>
						</div>
					</div>
				</div>
			</CardHeader>

			<CardContent className="pt-0">
				{!hasData ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
							<TrendingUp className="w-8 h-8 text-gray-400" />
						</div>
						<p className="text-gray-600 font-medium">No performance data yet</p>
						<p className="text-sm text-gray-500 mt-1">Start receiving tips to see your analytics</p>
					</div>
				) : dSeries.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
							<Calendar className="w-8 h-8 text-blue-600" />
						</div>
						<p className="text-gray-600 font-medium">No data in this range</p>
						<p className="text-sm text-gray-500 mt-1">Try selecting a different time period</p>
					</div>
				) : (
					<div ref={containerRef} className="w-full min-w-0">
						{/* Stats Cards - Mobile Optimized */}
						<div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
							{/* Range Total */}
							<div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-3 border border-blue-200/50">
								<div className="text-xs text-blue-600 font-medium mb-1">Period Total</div>
								<div className="text-lg sm:text-xl font-bold text-blue-900">{formatCedi(totals.sum)}</div>
							</div>

							{/* Lifetime */}
							<div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-3 border border-purple-200/50">
								<div className="text-xs text-purple-600 font-medium mb-1">Lifetime</div>
								<div className="text-lg sm:text-xl font-bold text-purple-900">{formatCedi(totals.lifetime)}</div>
							</div>

							{/* Best Period */}
							{totals.best && (
								<div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-3 border border-emerald-200/50">
									<div className="flex items-center gap-1 mb-1">
										<Award className="w-3 h-3 text-emerald-600" />
										<div className="text-xs text-emerald-600 font-medium">Best {granularity}</div>
									</div>
									<div className="text-lg sm:text-xl font-bold text-emerald-900">{formatCedi(totals.best.amount)}</div>
									<div className="text-xs text-emerald-600 mt-0.5 truncate">
										{humanLabel(totals.best.labelDate || dSeries.find(d=>d.amount===totals.best.amount)?.labelDate, granularity)}
									</div>
								</div>
							)}

							{/* Data Points */}
							<div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-3 border border-gray-200/50 lg:col-span-1 col-span-2 lg:block">
								<div className="text-xs text-gray-600 font-medium mb-1">Data Points</div>
								<div className="text-lg sm:text-xl font-bold text-gray-900">
									{dSeries.length} {granularity === "day" ? "days" : granularity === "week" ? "weeks" : "months"}
								</div>
							</div>
						</div>

						{/* Chart Container */}
						<div className="relative bg-white rounded-xl p-3 sm:p-4 border border-gray-100 shadow-sm">
							<svg
								viewBox={`0 0 ${width} ${height}`}
								className="w-full h-48 sm:h-56 md:h-64 select-none touch-none"
								onMouseMove={onMouseMove}
								onMouseLeave={onMouseLeave}
								onTouchMove={onTouchMove}
								onTouchEnd={onTouchEnd}
							>
								<defs>
									<linearGradient id="perfFill" x1="0" x2="0" y1="0" y2="1">
										<stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
										<stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
									</linearGradient>
									<linearGradient id="perfLine" x1="0" x2="1" y1="0" y2="0">
										<stop offset="0%" stopColor="#3b82f6" />
										<stop offset="100%" stopColor="#2563eb" />
									</linearGradient>
									<filter id="glow">
										<feGaussianBlur stdDeviation="2" result="coloredBlur"/>
										<feMerge>
											<feMergeNode in="coloredBlur"/>
											<feMergeNode in="SourceGraphic"/>
										</feMerge>
									</filter>
								</defs>

								{/* Grid lines */}
								{[0.25, 0.5, 0.75, 1].map((p, i) => (
									<line 
										key={i} 
										x1={pad} 
										x2={width - pad} 
										y1={pad + innerH * p} 
										y2={pad + innerH * p} 
										stroke="#e5e7eb" 
										strokeWidth="1" 
										strokeDasharray="4 2"
									/>
								))}

								{/* Area fill */}
								<path d={areaPath} fill="url(#perfFill)" />
								
								{/* Line with glow effect */}
								<path 
									d={linePath} 
									fill="none" 
									stroke="url(#perfLine)" 
									strokeWidth="3" 
									strokeLinejoin="round" 
									strokeLinecap="round"
									filter="url(#glow)"
								/>

								{/* X-axis labels */}
								{dSeries.map((d, i) => (i % Math.max(1, Math.round(dSeries.length / (width > 640 ? 6 : 4))) === 0) ? (
									<g key={d.key} transform={`translate(${pad + i * xStep}, ${height - pad + 14})`}>
										<text textAnchor="middle" fontSize="10" fill="#6b7280" className="font-medium">
											{humanTick(d.labelDate, granularity)}
										</text>
									</g>
								) : null)}

								{/* Hover indicators */}
								{hoverPoint && (
									<g>
										<line 
											x1={pad + hoverIndex * xStep} 
											x2={pad + hoverIndex * xStep} 
											y1={pad} 
											y2={height - pad} 
											stroke="#94a3b8" 
											strokeWidth="2"
											strokeDasharray="4 4" 
										/>
										<circle 
											cx={pad + hoverIndex * xStep} 
											cy={pad + yScale(hoverPoint.amount)} 
											r="6" 
											fill="#3b82f6" 
											stroke="#fff" 
											strokeWidth="3"
											filter="url(#glow)"
										/>
									</g>
								)}
							</svg>

							{/* Hover tooltip - Better positioned for mobile */}
							{hoverPoint && (
								<div 
									className="absolute z-10 pointer-events-none"
									style={{ 
										left: `${((pad + hoverIndex * xStep) / width) * 100}%`,
										top: '8px',
										transform: 'translateX(-50%)'
									}}
								>
									<div className="bg-slate-900 text-white px-3 py-2 rounded-lg shadow-xl border border-slate-700">
										<div className="text-xs font-medium text-slate-300 mb-0.5">
											{humanLabel(hoverPoint.labelDate, granularity)}
										</div>
										<div className="text-sm font-bold">{formatCedi(hoverPoint.amount)}</div>
									</div>
									{/* Arrow pointer */}
									<div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900 mx-auto"></div>
								</div>
							)}
						</div>

						{/* Info note */}
						<div className="mt-3 text-xs text-gray-500 text-center bg-gray-50 rounded-lg px-3 py-2">
							💡 Chart shows net amounts (after 20% platform fee). Tap/hover on chart for details.
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

