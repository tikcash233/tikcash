import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RecentTransactions({ transactions = [] }) {
	return (
		<Card className="border-none shadow-lg">
			<CardHeader>
				<CardTitle>Recent Transactions</CardTitle>
			</CardHeader>
			<CardContent>
				{transactions.length === 0 ? (
					<p className="text-gray-600">No transactions yet.</p>
				) : (
					<ul className="divide-y">
						{transactions.slice(0, 8).map((t) => (
							<li key={t.id} className="py-3 flex items-center justify-between">
								<div>
									<p className="font-medium capitalize">{t.transaction_type}</p>
									{t.supporter_name && (
										<p className="text-sm text-gray-500">From {t.supporter_name}</p>
									)}
								</div>
								<div className={t.amount >= 0 ? "text-green-600" : "text-red-600"}>
									{t.amount >= 0 ? "+" : ""}GH₵ {t.amount.toFixed(2)}
								</div>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

