import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PerformanceChart({ transactions = [] }) {
	// Derive a simple by-day sum for tips as a placeholder chart.
	const byDay = useMemo(() => {
		const map = new Map();
		for (const t of transactions) {
			if (t.transaction_type !== "tip") continue;
			const d = new Date(t.created_date || Date.now());
			const key = d.toISOString().slice(0, 10);
			map.set(key, (map.get(key) || 0) + (t.amount || 0));
		}
		return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
	}, [transactions]);

	return (
		<Card className="border-none shadow-lg">
			<CardHeader>
				<CardTitle>Performance</CardTitle>
			</CardHeader>
			<CardContent>
				{byDay.length === 0 ? (
					<p className="text-gray-600">No performance data yet.</p>
				) : (
					<div className="w-full overflow-x-auto">
						<div className="min-w-[400px] grid grid-cols-12 gap-2 items-end h-40">
							{byDay.map(([day, sum]) => (
								<div key={day} className="flex flex-col items-center">
									<div
										className="w-6 bg-blue-500 rounded"
										style={{ height: Math.max(4, Math.min(150, sum)) }}
										title={`GH₵ ${sum.toFixed(2)} on ${day}`}
									/>
									<span className="text-[10px] text-gray-500 mt-1">{day.slice(5)}</span>
								</div>
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

