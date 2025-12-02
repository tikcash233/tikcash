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
	const granularity = "day"; // permanently daily buckets for the simplified chart
	// Default to 7d instead of 30d
	const [rangeKey, setRangeKey] = useState("7d"); // simplified choices: 7d or current month
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

	// Range - Only last 7 days or current month (mobile-first simplified view)
	const { rangeStart, rangeEnd } = useMemo(() => {
		const now = new Date();
		const today = startOfDay(now);
		if (rangeKey === "month") {
			return { rangeStart: startOfMonth(now), rangeEnd: today };
		}
		// Default to 7 days (including today)
		return { rangeStart: addDays(today, -6), rangeEnd: today };
	}, [rangeKey]);

	// Build continuous series between start/end - always daily
	const series = useMemo(() => {
		const out = [];
		if (!hasData) return out;
		let cursor = new Date(rangeStart);
		while (cursor <= rangeEnd) {
			const key = isoDate(cursor);
			const next = addDays(cursor, 1);
			out.push({ key, amount: sumByBucket.get(key) || 0, labelDate: new Date(cursor) });
			cursor = next;
		}
		return out;
	}, [sumByBucket, rangeStart, rangeEnd, hasData]);

	const dSeries = series;

	// Totals (range + lifetime)
	const totals = useMemo(() => {
		const sum = dSeries.reduce((s, d) => s + d.amount, 0);
		const max = Math.max(0, ...dSeries.map((d) => d.amount));
		const best = dSeries.reduce((acc, d) => (d.amount > (acc?.amount || 0) ? d : acc), null);
		const lifetime = tips.reduce((s, t) => s + t.amount, 0);
		// Check if we have any non-zero data
		const hasNonZeroData = dSeries.some(d => d.amount > 0);
		return { sum, max, best, lifetime, hasNonZeroData };
	}, [dSeries, tips]);

	// Chart dims and scales (optimized for bar chart on mobile)
	const width = 860;
	const height = 260;
	const pad = 28;
	const innerW = width - pad * 2;
	const innerH = height - pad * 2;
	const maxY = totals.hasNonZeroData ? Math.max(25, totals.max * 1.2) : 50;
	const xStep = dSeries.length > 0 ? innerW / dSeries.length : 0;
	const yScale = (v) => innerH - (v / maxY) * innerH;
	const barWidth = dSeries.length > 0 ? Math.max(8, xStep * 0.55) : 0;
	const barOffset = xStep > 0 ? (xStep - barWidth) / 2 : 0;


	// Hover / touch - improved for mobile accuracy
	const onPosChange = (clientX, currentTarget) => {
		const rect = currentTarget.getBoundingClientRect();
		// Account for the SVG viewBox scaling
		const svgWidth = rect.width;
		const scaleX = width / svgWidth;
		const x = (clientX - rect.left) * scaleX;
		setHoverX(Math.max(pad, Math.min(width - pad, x)));
	};
	const onMouseMove = (e) => onPosChange(e.clientX, e.currentTarget);
	const onMouseLeave = () => setHoverX(null);
	const onTouchStart = (e) => {
		const t = e.touches[0];
		if (t) onPosChange(t.clientX, e.currentTarget);
	};
	const onTouchMove = (e) => {
		const t = e.touches[0];
		if (t) onPosChange(t.clientX, e.currentTarget);
	};
	const onTouchEnd = () => setHoverX(null);

	const hoverIndex = useMemo(() => {
		if (hoverX == null || xStep === 0) return null;
		const rel = hoverX - pad;
		const idx = Math.round(rel / xStep);
		return Math.max(0, Math.min(dSeries.length - 1, idx));
	}, [hoverX, xStep, dSeries.length]);
	const hoverPoint = hoverIndex != null ? dSeries[hoverIndex] : null;

	const hoverPosition = useMemo(() => {
		if (hoverPoint == null) return null;
		const centerX = pad + hoverIndex * xStep + (xStep / 2 || 0);
		const rawY = pad + yScale(hoverPoint.amount);
		const baselineY = pad + innerH - 4;
		const svgY = hoverPoint.amount > 0 ? rawY : baselineY;
		return { svgX: centerX, svgY };
	}, [hoverPoint, hoverIndex, xStep, pad, yScale, innerH]);

	const rangeButtons = [
		{ key: "7d", label: "Last 7 Days" },
		{ key: "month", label: "This Month" }
	];

	return (
		<Card className="border-none shadow-lg w-full overflow-hidden bg-gradient-to-br from-white to-blue-50/30">
			<CardHeader className="pb-3">
				<div className="flex items-center gap-2 mb-4">
					<div className="p-2 bg-blue-100 rounded-lg">
						<TrendingUp className="w-5 h-5 text-blue-600" />
					</div>
					<CardTitle className="text-xl">Performance Analytics</CardTitle>
				</div>

				{/* Simplified Range Selector */}
				<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
					<span className="text-xs font-medium text-gray-600 uppercase tracking-wide flex items-center gap-1">
						<Calendar className="w-3 h-3" />
						Time Period
					</span>
					<div className="grid grid-cols-2 sm:flex gap-2 flex-1 sm:flex-none">
						{rangeButtons.map((r) => (
							<button
								key={r.key}
								className={`px-4 py-2.5 sm:py-2 text-sm font-medium transition-all rounded-lg shadow-sm ${
									rangeKey === r.key 
										? "bg-blue-600 text-white shadow-md" 
										: "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
								}`}
								onClick={() => setRangeKey(r.key)}
							>
								{r.label}
							</button>
						))}
					</div>
				</div>
			</CardHeader>

			<CardContent className="pt-0">
				<div ref={containerRef} className="w-full min-w-0">
						{/* Stats Cards - Mobile Optimized */}
						<div className="grid grid-cols-2 lg:grid-cols-2 gap-2 sm:gap-3 mb-4">
							{/* Range Total */}
							<div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-3 border border-blue-200/50">
								<div className="text-xs text-blue-600 font-medium mb-1">Period Total</div>
								<div className="text-lg sm:text-xl font-bold text-blue-900">{formatCedi(totals.sum)}</div>
							</div>

							{/* Best Day */}
							{totals.best && totals.best.amount > 0 ? (
								<div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-3 border border-emerald-200/50">
									<div className="flex items-center gap-1 mb-1">
										<Award className="w-3 h-3 text-emerald-600" />
										<div className="text-xs text-emerald-600 font-medium">Best Day</div>
									</div>
									<div className="text-lg sm:text-xl font-bold text-emerald-900">{formatCedi(totals.best.amount)}</div>
									<div className="text-xs text-emerald-600 mt-0.5 truncate">
										{humanLabel(totals.best.labelDate || dSeries.find(d=>d.amount===totals.best.amount)?.labelDate, "day")}
									</div>
								</div>
							) : (
								<div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-3 border border-gray-200/50">
									<div className="flex items-center gap-1 mb-1">
										<Award className="w-3 h-3 text-gray-400" />
										<div className="text-xs text-gray-600 font-medium">Best Day</div>
									</div>
									<div className="text-lg sm:text-xl font-bold text-gray-700">{formatCedi(0)}</div>
									<div className="text-xs text-gray-500 mt-0.5">No data yet</div>
								</div>
							)}

						</div>

						{/* Chart Container - Horizontally scrollable on mobile for better readability */}
						{dSeries.length === 0 ? (
							<div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-500">
								No performance data in this range yet.
							</div>
						) : (
								<div className="relative bg-white rounded-xl p-2 sm:p-4 border border-gray-100 shadow-sm -mx-4 sm:mx-0 overflow-x-auto touch-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
									<div className="min-w-[560px] sm:min-w-0 w-full">
									<svg
										viewBox={`0 0 ${width} ${height}`}
										className="w-full h-[320px] sm:h-[360px] md:h-[400px] lg:h-[440px]"
										style={{ touchAction: 'manipulation' }}
										onMouseMove={onMouseMove}
										onMouseLeave={onMouseLeave}
										onTouchStart={onTouchStart}
										onTouchMove={onTouchMove}
										onTouchEnd={onTouchEnd}
									>
										<defs>
											<linearGradient id="barFill" x1="0" x2="0" y1="0" y2="1">
												<stop offset="0%" stopColor="#60a5fa" />
												<stop offset="100%" stopColor="#2563eb" />
											</linearGradient>
											<linearGradient id="barFillActive" x1="0" x2="0" y1="0" y2="1">
												<stop offset="0%" stopColor="#a5b4fc" />
												<stop offset="100%" stopColor="#4338ca" />
											</linearGradient>
											<filter id="barShadow" x="-50%" y="-50%" width="200%" height="200%">
												<feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#1d4ed8" floodOpacity="0.15" />
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

										{/* Bars */}
										{dSeries.map((d, i) => {
											const barHeight = Math.max(4, innerH - yScale(d.amount));
											const x = pad + i * xStep + barOffset;
											const y = pad + innerH - barHeight;
											const isActive = hoverIndex === i;
											const centerX = pad + i * xStep + (xStep / 2 || 0);
											return (
												<g key={d.key}>
													<rect
														x={x}
														y={y}
														width={Math.max(6, barWidth)}
														height={barHeight}
														rx={Math.min(10, barWidth / 2)}
														fill={isActive ? "url(#barFillActive)" : "url(#barFill)"}
														opacity={d.amount === 0 ? 0.35 : 0.95}
														filter="url(#barShadow)"
													/>
													{isActive && (
														<rect
															x={x - 2}
															y={y - 2}
															width={Math.max(6, barWidth) + 4}
															height={barHeight + 4}
															rx={Math.min(12, barWidth / 2 + 2)}
															stroke="#1d4ed8"
															strokeWidth="1.5"
															fill="none"
														/>
													)}

												{/* Subtle indicator dot at base for zero days */}
												{d.amount === 0 && (
													<circle cx={centerX} cy={pad + innerH + 4} r="3" fill="#94a3b8" opacity="0.6" />
												)}
											</g>
											);
										})}

										{/* X-axis labels */}
										{dSeries.map((d, i) => (i % Math.max(1, Math.round(dSeries.length / (width > 640 ? 6 : 4))) === 0) ? (
											<g key={d.key} transform={`translate(${pad + i * xStep + (xStep / 2 || 0)}, ${height - pad + 14})`}>
												<text textAnchor="middle" fontSize="10" fill="#6b7280" className="font-medium">
													{humanTick(d.labelDate, "day")}
												</text>
											</g>
										) : null)}
									</svg>
								</div>

									{hoverPoint && hoverPosition && (
										<div
											className="absolute z-10 pointer-events-none"
											style={{
												left: `${Math.min(95, Math.max(5, (hoverPosition.svgX / width) * 100))}%`,
												top: `${Math.max(2, (hoverPosition.svgY / height) * 100 - (42 / height) * 100)}%`,
												transform: 'translate(-50%, -4px)'
											}}
										>
											<div className="bg-slate-900 text-white px-3 py-2 rounded-lg shadow-xl border border-slate-700">
												<div className="text-xs font-medium text-slate-300 mb-0.5">
													{humanLabel(hoverPoint.labelDate, "day")}
												</div>
												<div className="text-sm font-bold">{formatCedi(hoverPoint.amount)}</div>
											</div>
											<div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900 mx-auto"></div>
										</div>
									)}
								</div>
							)}

						{/* Info note */}
						<div className="mt-3 text-xs text-gray-500 text-center bg-gray-50 rounded-lg px-3 py-2">
							{totals.hasNonZeroData ? (
								<>💡 Chart shows net amounts (after 20% platform fee). Tap/hover on chart for details.</>
							) : (
								<>📊 Chart shows your earning trends. Currently showing baseline - start receiving tips to see growth!</>
							)}
						</div>
					</div>
			</CardContent>
		</Card>
	);
}

