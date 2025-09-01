import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function EarningsOverview({ creator, onWithdraw }) {
	const available = creator?.available_balance || 0;
	const total = creator?.total_earnings || 0;

	return (
		<Card className="border-none shadow-lg">
			<CardHeader>
				<CardTitle>Earnings Overview</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
					<div>
						<p className="text-sm text-gray-600">Total Earnings</p>
						<p className="text-3xl font-bold">GH₵ {total.toFixed(2)}</p>
					</div>
					<div>
						<p className="text-sm text-gray-600">Available Balance</p>
						<p className="text-3xl font-bold text-green-600">GH₵ {available.toFixed(2)}</p>
					</div>
					<div className="flex md:justify-end">
						<Button disabled={available <= 0} onClick={onWithdraw}>Withdraw</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

