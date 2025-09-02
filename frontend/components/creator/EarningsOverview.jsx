import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, CreditCard, PiggyBank } from "lucide-react";

export default function EarningsOverview({ creator, onWithdraw }) {
	const available = creator?.available_balance || 0;
	const total = creator?.total_earnings || 0;

	return (
		<Card className="border-none shadow-lg">
			<CardHeader className="flex flex-row items-center justify-between pb-4">
				<div className="flex items-center gap-2">
					<CreditCard className="w-4 h-4 text-blue-600" />
					<CardTitle>Earnings Overview</CardTitle>
				</div>
				<Button
					onClick={onWithdraw}
					disabled={available <= 0}
					className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
				>
					<ArrowUpRight className="w-4 h-4" />
					Withdraw
				</Button>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{/* Available Balance Card */}
					<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-6 sm:p-8 shadow-md">
						<div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
						<div className="absolute -bottom-10 -left-10 w-40 h-40 bg-black/10 rounded-full blur-2xl" />
						<div className="flex items-start justify-between">
							<div>
								<p className="text-sm text-blue-100">Available Balance</p>
								<p className="mt-1 text-4xl font-bold">GH₵ {available.toFixed(2)}</p>
								<p className="mt-2 text-sm text-blue-100">Ready to withdraw</p>
							</div>
							<div className="p-3 bg-white/10 rounded-xl">
								<CreditCard className="w-6 h-6 text-white" />
							</div>
						</div>
						<div className="mt-6 text-xs text-blue-100">TikCash Card</div>
					</div>

					{/* Total Earnings Card */}
					<div className="relative overflow-hidden rounded-2xl bg-slate-900 text-white p-6 sm:p-8 shadow-md">
						<div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
						<div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
						<div className="flex items-start justify-between">
							<div>
								<p className="text-sm text-slate-300">Total Earnings</p>
								<p className="mt-1 text-4xl font-bold">GH₵ {total.toFixed(2)}</p>
								<p className="mt-2 text-sm text-slate-300">Lifetime earnings</p>
							</div>
							<div className="p-3 bg-white/10 rounded-xl">
								<PiggyBank className="w-6 h-6 text-white" />
							</div>
						</div>
						<div className="mt-6 text-xs text-slate-300">Platinum Card</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

