import React, { useMemo, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatCedi(v) {
	const n = Number(v || 0);
	return `GH₵ ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PerformanceChart({ transactions = [] }) {
	const [rangeDays, setRangeDays] = useState(30); // 7 or 30
	const [hoverX, setHoverX] = useState(null); // pixel x for hover
	const containerRef = useRef(null);

	// Aggregate tips by ISO date (YYYY-MM-DD)
	const allDays = useMemo(() => {
		const map = new Map();
		for (const t of transactions) {
			if (t.transaction_type !== "tip") continue;
			const d = new Date(t.created_date || Date.now());
			const key = d.toISOString().slice(0, 10);
			map.set(key, (map.get(key) || 0) + (t.amount || 0));
		}
		return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
	}, [transactions]);

	// Build a continuous series for last N days
	const series = useMemo(() => {
		if (!allDays.length) return [];
		const end = new Date(allDays[allDays.length - 1][0]);
		const start = new Date(end);
		start.setDate(start.getDate() - (rangeDays - 1));

		const byDate = new Map(allDays);
		const out = [];
		const cur = new Date(start);
		while (cur <= end) {
			const key = cur.toISOString().slice(0, 10);
			out.push({ date: key, amount: byDate.get(key) || 0 });
			cur.setDate(cur.getDate() + 1);
		}
		return out;
	}, [allDays, rangeDays]);

	const totals = useMemo(() => {
		const sum = series.reduce((s, d) => s + d.amount, 0);
		const max = Math.max(0, ...series.map(d => d.amount));
		const best = series.reduce((acc, d) => (d.amount > (acc?.amount || 0) ? d : acc), null);
		return { sum, max, best };
	}, [series]);

	// Chart dimensions
	const width = 800; // intrinsic; scales responsively via viewBox
	const height = 220;
	const pad = 24;
	const innerW = width - pad * 2;
	const innerH = height - pad * 2;

	// Scales
	const maxY = Math.max(10, totals.max * 1.1);
	const xStep = series.length > 1 ? innerW / (series.length - 1) : 0;
	const yScale = (v) => innerH - (v / maxY) * innerH;

	// Paths
	const linePath = useMemo(() => {
		if (series.length === 0) return "";
		const parts = series.map((d, i) => `${i === 0 ? "M" : "L"} ${pad + i * xStep} ${pad + yScale(d.amount)}`);
		return parts.join(" ");
	}, [series, xStep]);

	const areaPath = useMemo(() => {
		if (series.length === 0) return "";
		const top = series.map((d, i) => `${i === 0 ? "M" : "L"} ${pad + i * xStep} ${pad + yScale(d.amount)}`).join(" ");
		const bottom = `L ${pad + (series.length - 1) * xStep} ${pad + innerH} L ${pad} ${pad + innerH} Z`;
		return `${top} ${bottom}`;
	}, [series, xStep, innerH]);

	// Hover logic
	const onMouseMove = (e) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		setHoverX(Math.max(pad, Math.min(width - pad, x)));
	};

	const onMouseLeave = () => setHoverX(null);

	const hoverIndex = useMemo(() => {
		if (hoverX == null || xStep === 0) return null;
		const rel = hoverX - pad;
		const idx = Math.round(rel / xStep);
		return Math.max(0, Math.min(series.length - 1, idx));
	}, [hoverX, xStep, series.length]);

	const hoverPoint = hoverIndex != null ? series[hoverIndex] : null;

	return (
		<Card className="border-none shadow-lg w-full overflow-hidden">
			<CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				<CardTitle>Weekly Earnings</CardTitle>
				<div className="flex gap-2">
					<button
						className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${rangeDays === 7 ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:bg-gray-50 border-gray-300"}`}
						onClick={() => setRangeDays(7)}
					>
						7D
					</button>
					<button
						className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${rangeDays === 30 ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:bg-gray-50 border-gray-300"}`}
						onClick={() => setRangeDays(30)}
					>
						30D
					</button>
				</div>
			</CardHeader>
			<CardContent>
				{series.length === 0 ? (
					<p className="text-gray-600">No performance data yet.</p>
				) : (
					<div ref={containerRef} className="w-full min-w-0">
						{/* Summary */}
						<div className="flex flex-wrap items-center gap-4 mb-3 text-sm">
							<span className="text-gray-700">Total: <strong>{formatCedi(totals.sum)}</strong></span>
							{totals.best && (
								<span className="text-gray-700">Best day: <strong>{formatCedi(totals.best.amount)}</strong> on <strong>{totals.best.date}</strong></span>
							)}
						</div>

						<div className="relative">
							<svg
								viewBox={`0 0 ${width} ${height}`}
								className="w-full h-64 select-none"
								onMouseMove={onMouseMove}
								onMouseLeave={onMouseLeave}
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

								{/* Grid */}
								{[0.25, 0.5, 0.75, 1].map((p, i) => (
									<line key={i} x1={pad} x2={width - pad} y1={pad + innerH * p} y2={pad + innerH * p} stroke="#e5e7eb" strokeWidth="1" />
								))}

								{/* Area */}
								<path d={areaPath} fill="url(#perfFill)" />

								{/* Line */}
								<path d={linePath} fill="none" stroke="url(#perfLine)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

								{/* X ticks: show 4 evenly spaced labels */}
								{series.map((d, i) => (i % Math.max(1, Math.round(series.length / 4)) === 0) ? (
									<g key={d.date} transform={`translate(${pad + i * xStep}, ${height - pad + 14})`}>
										<text textAnchor="middle" fontSize="10" fill="#6b7280">{d.date.slice(5)}</text>
									</g>
								) : null)}

								{/* Hover marker */}
								{hoverPoint && (
									<g>
										<line x1={pad + hoverIndex * xStep} x2={pad + hoverIndex * xStep} y1={pad} y2={height - pad} stroke="#94a3b8" strokeDasharray="4 4" />
										<circle cx={pad + hoverIndex * xStep} cy={pad + yScale(hoverPoint.amount)} r="4" fill="#2563eb" stroke="#fff" strokeWidth="2" />
									</g>
								)}
							</svg>

							{/* Tooltip */}
							{hoverPoint && (
								<div
									className="absolute -translate-x-1/2 -translate-y-2 px-2 py-1 rounded-md bg-slate-800 text-white text-xs shadow"
									style={{ left: `${((pad + hoverIndex * xStep) / width) * 100}%`, top: 8 }}
								>
									<div className="font-semibold">{hoverPoint.date}</div>
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

